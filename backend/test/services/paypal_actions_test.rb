require "test_helper"

class PaypalActionsTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :calls

    def initialize
      @calls = []
    end

    def capture(auth_id, request_id:)
      @calls << [ :capture, auth_id, request_id ]
      { "id" => "CAP-1" }
    end

    def void(auth_id, request_id:)
      @calls << [ :void, auth_id, request_id ]
      {}
    end

    def refund(capture_id, request_id:)
      @calls << [ :refund, capture_id, request_id ]
      { "id" => "REF-1" }
    end
  end

  AI = { "action" => "review", "confidence" => 0.85, "explanation" => "Unknown device and a large amount." }.freeze

  setup do
    RiskRuleConfig.reset_cache!
    @client = FakeClient.new
    @actions = PaypalActions.new(client: @client)
  end

  teardown { RiskRuleConfig.reset_cache! }

  def payment(amount: 100, paypal_status: "AUTHORIZED", with_ai: true)
    transaction = users(:one).transactions.create!(amount: amount, payment_method: "wallet", device_id: "d", status: "FLAGGED",
                                                   paypal_status: paypal_status, paypal_authorization_id: "AUTH-1",
                                                   paypal_capture_id: (paypal_status == "CAPTURED" ? "CAP-1" : nil))
    FraudEvaluation.create!(financial_transaction: transaction, risk_score: 30, ai_verdict: (with_ai ? AI : nil))
    transaction
  end

  def audit_for(transaction, type)
    AuditLog.where(event_type: type, entity_id: transaction.id)
  end

  test "capture moves AUTHORIZED to CAPTURED, records who and why, and audits with the AI explanation" do
    t = payment
    @actions.capture(t, actor: "Agent", reason: "inside the limits", auto: true)
    t.reload
    assert_equal "CAPTURED", t.paypal_status
    assert_equal "CAP-1", t.paypal_capture_id
    assert_equal "auto", t.paypal_capture_mode
    assert_not_nil t.paypal_captured_at
    assert_equal [ [ :capture, "AUTH-1", "capture-#{t.id}" ] ], @client.calls
    log = audit_for(t, "PAYPAL_CAPTURED").sole
    assert_includes log.description, "Agent: inside the limits"
    assert_includes log.description, "Unknown device and a large amount."
  end

  test "capture is idempotent: the second call changes nothing and does not call PayPal" do
    t = payment
    2.times { @actions.capture(t, actor: "Agent", reason: "r", auto: true) }
    assert_equal 1, @client.calls.size
    assert_equal 1, audit_for(t, "PAYPAL_CAPTURED").count
  end

  test "an automatic capture above the limit is refused and PayPal is not called" do
    t = payment(amount: 1_000.01)
    assert_raises(PaypalActions::LimitExceeded) { @actions.capture(t, actor: "Agent", reason: "r", auto: true) }
    assert_empty @client.calls
    assert_equal "AUTHORIZED", t.reload.paypal_status
  end

  test "an automatic capture past the daily cap is refused, a human capture is not" do
    users(:one).transactions.create!(amount: 4_500, payment_method: "wallet", device_id: "d", paypal_status: "CAPTURED",
                                     paypal_capture_mode: "auto", paypal_captured_at: Time.current)
    t = payment(amount: 600)
    assert_raises(PaypalActions::LimitExceeded) { @actions.capture(t, actor: "Agent", reason: "r", auto: true) }
    @actions.capture(t, actor: "admin@example.com", reason: "Approved by a human")
    assert_equal "human", t.reload.paypal_capture_mode
    assert_equal "CAPTURED", t.paypal_status
  end

  test "a held payment can be captured by a human" do
    t = payment(paypal_status: "HELD")
    @actions.capture(t, actor: "admin@example.com", reason: "ok")
    assert_equal "CAPTURED", t.reload.paypal_status
  end

  test "hold is idempotent and never calls PayPal" do
    t = payment
    2.times { @actions.hold(t, actor: "Agent", reason: "flagged") }
    assert_equal "HELD", t.reload.paypal_status
    assert_empty @client.calls
    assert_equal 1, audit_for(t, "PAYPAL_HELD").count
  end

  test "void releases an authorized or held payment once" do
    [ "AUTHORIZED", "HELD" ].each do |state|
      t = payment(paypal_status: state)
      2.times { @actions.void(t, actor: "Agent", reason: "blocked") }
      assert_equal "VOIDED", t.reload.paypal_status
      assert_equal 1, audit_for(t, "PAYPAL_VOIDED").count
    end
    assert_equal 2, @client.calls.count { |c| c.first == :void }
  end

  test "refund returns a captured payment once and stores the refund id" do
    t = payment(paypal_status: "CAPTURED")
    2.times { @actions.refund(t, actor: "admin@example.com", reason: "customer asked") }
    t.reload
    assert_equal "REFUNDED", t.paypal_status
    assert_equal "REF-1", t.paypal_refund_id
    assert_equal [ [ :refund, "CAP-1", "refund-#{t.id}" ] ], @client.calls
    assert_equal 1, audit_for(t, "PAYPAL_REFUNDED").count
  end

  test "actions refuse a state they cannot move from" do
    assert_raises(PaypalActions::InvalidState) { @actions.refund(payment, actor: "a", reason: "r") }
    assert_raises(PaypalActions::InvalidState) { @actions.void(payment(paypal_status: "CAPTURED"), actor: "a", reason: "r") }
    assert_raises(PaypalActions::InvalidState) { @actions.capture(payment(paypal_status: "VOIDED"), actor: "a", reason: "r") }
    assert_raises(PaypalActions::InvalidState) { @actions.hold(payment(paypal_status: "CAPTURED"), actor: "a", reason: "r") }
    assert_empty @client.calls
  end

  test "the audit entry works without an AI verdict" do
    t = payment(with_ai: false)
    @actions.hold(t, actor: "Agent", reason: "flagged")
    assert_equal "Agent: flagged", audit_for(t, "PAYPAL_HELD").sole.description
  end

  test "a PayPal failure leaves the payment and the log unchanged" do
    t = payment
    failing = Object.new
    def failing.capture(*, **) = raise(PaypalClient::Error, "boom")
    assert_raises(PaypalClient::Error) { PaypalActions.new(client: failing).capture(t, actor: "Agent", reason: "r", auto: true) }
    assert_equal "AUTHORIZED", t.reload.paypal_status
    assert_equal 0, audit_for(t, "PAYPAL_CAPTURED").count
  end
end
