require "test_helper"

class PaymentLifecycleTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :calls
    attr_accessor :refund_error

    def initialize = @calls = []

    def capture(auth_id, request_id:)
      @calls << [ :capture, auth_id, request_id ]
      { "id" => "CAP-1" }
    end

    def void(auth_id, request_id:)
      @calls << [ :void, auth_id, request_id ]
      {}
    end

    def refund(capture_id, request_id:, amount: nil)
      raise refund_error if refund_error

      @calls << [ :refund, capture_id, request_id, amount&.to_s("F") ]
      { "id" => "REF-#{@calls.size}" }
    end
  end

  setup do
    RiskRuleConfig.reset_cache!
    @client = FakeClient.new
    @actions = PaypalActions.new(client: @client)
  end

  def payment(amount: 100, paypal_status: "CAPTURED", expires_at: nil)
    users(:one).transactions.create!(amount: amount, payment_method: "wallet", device_id: "d", status: "FLAGGED", paypal_status: paypal_status,
                                     paypal_authorization_id: "AUTH-1", paypal_authorization_expires_at: expires_at,
                                     paypal_capture_id: (paypal_status == "CAPTURED" ? "CAP-1" : nil))
  end

  def refund(t, amount = nil) = @actions.refund(t, actor: "admin@example.com", reason: "customer asked", amount: amount)

  # ---- partial refunds

  test "a partial refund keeps the payment captured-and-refundable and tracks the total" do
    t = payment
    refund(t, 30)
    t.reload
    assert_equal "PARTIALLY_REFUNDED", t.paypal_status
    assert_equal 30, t.refunded_amount
    assert_equal 70, t.refundable_amount
    assert_equal [ [ :refund, "CAP-1", "refund-#{t.id}-0-3000", "30.0" ] ], @client.calls
  end

  test "refunds add up and the last one makes the payment REFUNDED" do
    t = payment
    refund(t, 30)
    refund(t, 70)
    t.reload
    assert_equal "REFUNDED", t.paypal_status
    assert_equal 100, t.refunded_amount
    assert_equal 1, AuditLog.where(event_type: "PAYPAL_PARTIALLY_REFUNDED", entity_id: t.id).count
    assert_equal 1, AuditLog.where(event_type: "PAYPAL_REFUNDED", entity_id: t.id).count
  end

  test "a refund without an amount returns what is left, as a full refund does when nothing was refunded" do
    t = payment
    refund(t, 40)
    refund(t)
    assert_equal "REFUNDED", t.reload.paypal_status
    assert_equal 100, t.refunded_amount
    assert_equal [ :refund, "CAP-1", "refund-#{t.id}-4000-6000", nil ], @client.calls.last
  end

  test "the first full refund keeps the plain request id" do
    t = payment
    refund(t)
    assert_equal [ [ :refund, "CAP-1", "refund-#{t.id}", nil ] ], @client.calls
  end

  test "the total can never pass the captured amount" do
    t = payment
    refund(t, 60)
    error = assert_raises(PaypalActions::InvalidAmount) { refund(t, 50) }
    assert_includes error.message, "at most 40.0"
    assert_equal 60, t.reload.refunded_amount
    assert_equal 1, @client.calls.size
  end

  test "zero and negative refund amounts are refused" do
    t = payment
    assert_raises(PaypalActions::InvalidAmount) { refund(t, 0) }
    assert_raises(PaypalActions::InvalidAmount) { refund(t, -5) }
    assert_empty @client.calls
  end

  test "a fully refunded payment cannot be refunded again with an amount, and asking for a full refund is a no-op" do
    t = payment
    refund(t)
    assert_raises(PaypalActions::InvalidState) { refund(t, 10) }
    assert_nothing_raised { refund(t) }
    assert_equal 1, @client.calls.size
  end

  test "an uncaptured payment cannot be refunded" do
    assert_raises(PaypalActions::InvalidState) { refund(payment(paypal_status: "HELD"), 10) }
  end

  # ---- merchant balance

  test "an insufficient merchant balance becomes InsufficientFunds and changes nothing" do
    t = payment
    @client.refund_error = PaypalClient::Error.new("Refund failed", status: 422, issue: "REFUND_FAILED_INSUFFICIENT_FUNDS")
    error = assert_raises(PaypalActions::InsufficientFunds) { refund(t) }
    assert_includes error.message, "merchant balance"
    t.reload
    assert_equal "CAPTURED", t.paypal_status
    assert_equal 0, t.refunded_amount
    assert_empty AuditLog.where(entity_id: t.id)
  end

  test "any other PayPal error still propagates" do
    @client.refund_error = PaypalClient::Error.new("boom", status: 500)
    assert_raises(PaypalClient::Error) { refund(payment) }
  end

  # ---- expiry

  test "an expired authorization cannot be captured" do
    t = payment(paypal_status: "HELD", expires_at: 1.hour.ago)
    error = assert_raises(PaypalActions::InvalidState) { @actions.capture(t, actor: "admin@example.com", reason: "ok") }
    assert_includes error.message, "expired"
    assert_empty @client.calls
  end

  test "a payment authorized through checkout stores when it was authorized and when it lapses" do
    freeze_time do
      client = SimulatedPaypalClient.new
      checkout = PaypalCheckout.new(user: users(:one), client: client)
      transaction = checkout.create_order(amount: 20, device_id: "dev-1")
      checkout.settle(transaction.paypal_order_id)
      transaction.reload
      assert_equal Time.current.change(usec: 0), transaction.paypal_authorized_at.change(usec: 0)
      assert_equal (Time.current + Transaction::AUTHORIZATION_TTL).change(usec: 0), transaction.paypal_authorization_expires_at.change(usec: 0)
    end
  end

  # ---- ExpiringHoldsJob

  def held(expires_in:, simulated: true)
    t = payment(paypal_status: "HELD", expires_at: expires_in.from_now)
    t.update!(paypal_order_id: simulated ? "SIM-ORDER-#{t.id}" : "ORDER-#{t.id}")
    t
  end

  test "the job voids a hold that is about to lapse, as the system, and leaves others alone" do
    soon = held(expires_in: 6.hours)
    later = held(expires_in: 10.days)
    ExpiringHoldsJob.perform_now
    assert_equal "VOIDED", soon.reload.paypal_status
    assert_includes soon.paypal_action_reason, "voided before it lapsed"
    assert_equal "HELD", later.reload.paypal_status
    assert_includes AuditLog.where(event_type: "PAYPAL_VOIDED", entity_id: soon.id).sole.description, "System:"
  end

  test "the job alerts staff once when a hold is within three days of lapsing" do
    t = held(expires_in: 48.hours)
    staff = User.where(role: %i[admin manager], status: :active).count
    assert_difference("Notification.count", staff) { ExpiringHoldsJob.perform_now }
    assert_no_difference("Notification.count") { ExpiringHoldsJob.perform_now }
    assert_equal "HELD", t.reload.paypal_status
    note = Notification.where(notification_type: "system").order(:created_at).last
    assert_equal "high", note.priority
    assert_equal t.id.to_s, note.data["transaction_id"]
  end

  test "the job never captures and ignores captured and voided payments" do
    captured = payment(paypal_status: "CAPTURED", expires_at: 1.hour.from_now)
    ExpiringHoldsJob.perform_now
    assert_equal "CAPTURED", captured.reload.paypal_status
  end

  test "a PayPal failure while voiding is logged and the next hold is still handled" do
    first = held(expires_in: 2.hours, simulated: false)
    second = held(expires_in: 3.hours)
    replace_class_method(PaypalClient, :new, ->(*) { raise PaypalClient::NotConfigured, "PayPal is not configured" }) { ExpiringHoldsJob.perform_now }
    assert_equal "HELD", first.reload.paypal_status
    assert_equal "VOIDED", second.reload.paypal_status
  end
end
