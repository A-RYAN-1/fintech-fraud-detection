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
  def settle_as(status, order_id, ai: nil)
    evaluator = lambda do |transaction|
      Struct.new(:t) do
        define_method(:evaluate) do
          t.update!(status: status, risk_score: 10)
          FraudEvaluation.create!(financial_transaction: t, risk_score: 10, ai_verdict: ai)
        end
      end.new(transaction)
    end
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
    other = PaypalCheckout.new(user: users(:reviewer), client: @client)
    assert_raises(ActiveRecord::RecordNotFound) { other.settle(order_id) }
  end

  AI_REVIEW = { "action" => "review", "confidence" => 0.9, "explanation" => "Unusual device." }.freeze
  AI_APPROVE = { "action" => "approve", "confidence" => 0.9, "explanation" => "Looks normal." }.freeze

  test "an approved payment the AI escalates is held, not captured" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    result = settle_as("SUCCESS", order_id, ai: AI_REVIEW)
    assert_equal "held", result.decision
    assert_match(/AI analyst escalated/, result.transaction.paypal_action_reason)
    refute_includes @client.calls.map(&:first), :capture
    assert_includes AuditLog.find_by!(event_type: "PAYPAL_HELD", entity_id: result.transaction.id).description, "Unusual device."
  end

  test "an approved payment the AI confirms is captured by the agent" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    result = settle_as("SUCCESS", order_id, ai: AI_APPROVE)
    assert_equal "captured", result.decision
    assert_equal "auto", result.transaction.paypal_capture_mode
  end

  test "the AI cannot capture a payment the rules flagged" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    assert_equal "held", settle_as("FLAGGED", order_id, ai: AI_APPROVE).decision
  end

  test "the AI cannot void a payment the rules approved" do
    order_id = @checkout.create_order(amount: 10, device_id: "dev-1").paypal_order_id
    ai_block = AI_REVIEW.merge("action" => "block")
    assert_equal "held", settle_as("SUCCESS", order_id, ai: ai_block).decision
    refute_includes @client.calls.map(&:first), :void
  end

  test "an approved payment above the auto-capture limit is held with the limit as the reason" do
    order_id = @checkout.create_order(amount: 1_500, device_id: "dev-1").paypal_order_id
    result = settle_as("SUCCESS", order_id, ai: AI_APPROVE)
    assert_equal "held", result.decision
    assert_match(/auto-capture limit/, result.transaction.paypal_action_reason)
  end

  test "an approved payment that would pass the daily cap is held" do
    @user.transactions.create!(amount: 4_500, payment_method: "wallet", device_id: "d", paypal_status: "CAPTURED",
                               paypal_capture_mode: "auto", paypal_captured_at: Time.current)
    order_id = @checkout.create_order(amount: 600, device_id: "dev-1").paypal_order_id
    assert_equal "held", settle_as("SUCCESS", order_id).decision
  end
end
