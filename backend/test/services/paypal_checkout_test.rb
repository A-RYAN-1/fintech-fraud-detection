require "test_helper"

class PaypalCheckoutTest < ActiveSupport::TestCase
  # Records the calls PaypalCheckout makes instead of reaching PayPal.
  class FakeClient
    attr_reader :calls

    def initialize
      @calls = []
    end

    def create_order(amount:, currency:, reference:, **)
      @calls << [ :create_order, amount.to_s, currency ]
      { "id" => "ORDER-#{reference.to_s.first(8)}", "status" => "CREATED" }
    end

    def authorize_order(order_id, **)
      @calls << [ :authorize_order, order_id ]
      { "id" => "AUTH-1", "status" => "CREATED" }
    end

    def capture(auth_id, **)
      @calls << [ :capture, auth_id ]
      { "id" => "CAP-1", "status" => "COMPLETED" }
    end

    def void(auth_id, **)
      @calls << [ :void, auth_id ]
      {}
    end
  end

  setup do
    @user = users(:one)
    @client = FakeClient.new
    @checkout = PaypalCheckout.new(user: @user, client: @client)
  end

  # Stands in for the risk evaluator: sets the status the real one would reach.
  def settle_as(status, order_id)
    evaluator = ->(transaction) { Struct.new(:t) { define_method(:evaluate) { t.update!(status: status, risk_score: 10) } }.new(transaction) }
    result = nil
    replace_class_method(TransactionRiskEvaluator, :new, evaluator) { result = @checkout.settle(order_id) }
    result
  end

  test "create_order stores a pending wallet transaction with the PayPal order id" do
    transaction = @checkout.create_order(amount: BigDecimal("25.50"), device_id: "dev-1")
    assert transaction.pending?
    assert_equal "wallet", transaction.payment_method
    assert_equal "CREATED", transaction.paypal_status
    assert transaction.paypal_order_id.start_with?("ORDER-")
    assert_equal [ :create_order, "25.5", "USD" ], @client.calls.first
  end

  test "an approved payment is captured and audited" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    result = settle_as("SUCCESS", order_id)
    assert_equal "captured", result.decision
    assert_equal "CAP-1", result.transaction.paypal_capture_id
    assert_equal "CAPTURED", result.transaction.paypal_status
    assert_includes @client.calls.map(&:first), :capture
    assert AuditLog.exists?(event_type: "PAYPAL_CAPTURED", entity_id: result.transaction.id)
  end

  test "a flagged payment is held: authorized, not captured, not voided" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    result = settle_as("FLAGGED", order_id)
    assert_equal "held", result.decision
    assert_equal "HELD", result.transaction.paypal_status
    assert_nil result.transaction.paypal_capture_id
    assert_empty @client.calls.map(&:first) & %i[capture void]
    assert AuditLog.exists?(event_type: "PAYPAL_HELD", entity_id: result.transaction.id)
  end

  test "a blocked payment voids the authorization so nothing is charged" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    result = settle_as("BLOCKED", order_id)
    assert_equal "voided", result.decision
    assert_equal "VOIDED", result.transaction.paypal_status
    assert_includes @client.calls.map(&:first), :void
    refute_includes @client.calls.map(&:first), :capture
  end

  test "settling twice does not authorize or capture twice" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    settle_as("SUCCESS", order_id)
    before = @client.calls.size
    result = @checkout.settle(order_id)
    assert_equal "captured", result.decision
    assert_equal before, @client.calls.size
  end

  test "another user cannot settle someone else's order" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    other = PaypalCheckout.new(user: users(:manager), client: @client)
    assert_raises(ActiveRecord::RecordNotFound) { other.settle(order_id) }
  end
end
