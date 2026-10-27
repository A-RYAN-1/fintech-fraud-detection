require "test_helper"

class ReviewQueueTest < ActionDispatch::IntegrationTest
  class FakeClient
    def capture(_id, **) = { "id" => "CAP-9" }
    def void(_id, **) = {}
    def refund(_id, **) = { "id" => "REF-9" }
  end

  AI = { "action" => "review", "confidence" => 0.8, "explanation" => "Large amount on a new device." }.freeze

  setup do
    RiskRuleConfig.reset_cache!
    @held = held_payment("HELD")
  end

  def held_payment(paypal_status, amount: 300)
    t = users(:one).transactions.create!(amount: amount, payment_method: "wallet", device_id: "d", status: "FLAGGED", risk_score: 30,
                                         paypal_status: paypal_status, paypal_authorization_id: "AUTH-1",
                                         paypal_capture_id: (paypal_status == "CAPTURED" ? "CAP-1" : nil))
    FraudEvaluation.create!(financial_transaction: t, risk_score: 30, rules_triggered: "UNTRUSTED_DEVICE,ML_RISK_SCORE", ai_verdict: AI, ml_score: 0.7)
    t
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def body = JSON.parse(response.body)

  def with_paypal(&block)
    replace_class_method(PaypalClient, :configured?, -> { true }) do
      replace_class_method(PaypalClient, :new, ->(*) { FakeClient.new }, &block)
    end
  end

  test "every route requires a session" do
    get "/api/v1/admin/review_queue"
    assert_response :unauthorized
    post "/api/v1/admin/review_queue/#{@held.id}/approve"
    assert_response :unauthorized
  end

  test "a customer can neither list nor act" do
    login_as users(:one)
    get "/api/v1/admin/review_queue"
    assert_response :forbidden
    with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/approve" }
    assert_response :forbidden
    assert_equal "HELD", @held.reload.paypal_status
  end

  test "a manager can read the queue but not act" do
    login_as users(:manager)
    get "/api/v1/admin/review_queue"
    assert_response :success
    with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/void" }
    assert_response :forbidden
    assert_equal "HELD", @held.reload.paypal_status
  end

  test "the queue lists held payments with rules, model reasons and the AI explanation, and nothing else" do
    held_payment("CAPTURED")
    login_as users(:admin)
    get "/api/v1/admin/review_queue"
    assert_response :success
    rows = body.dig("data", "held")
    assert_equal [ @held.id ], rows.map { |r| r["id"] }
    row = rows.first
    assert_equal %w[UNTRUSTED_DEVICE ML_RISK_SCORE], row["rules_triggered"]
    assert_equal "Large amount on a new device.", row.dig("ai_verdict", "explanation")
    assert_equal 1, body.dig("data", "meta", "total_count")
  end

  test "approve captures a held payment as a human, audited with the admin and the AI explanation" do
    login_as users(:admin)
    with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/approve", params: { note: "Customer called" } }
    assert_response :success
    @held.reload
    assert_equal "CAPTURED", @held.paypal_status
    assert_equal "human", @held.paypal_capture_mode
    log = AuditLog.where(event_type: "PAYPAL_CAPTURED", entity_id: @held.id).sole
    assert_includes log.description, "admin@example.com"
    assert_includes log.description, "Customer called"
    assert_includes log.description, "Large amount on a new device."
  end

  test "a human can approve above the auto-capture limit" do
    big = held_payment("HELD", amount: 9_000)
    login_as users(:admin)
    with_paypal { post "/api/v1/admin/review_queue/#{big.id}/approve" }
    assert_response :success
    assert_equal "CAPTURED", big.reload.paypal_status
  end

  test "approving twice is safe" do
    login_as users(:admin)
    2.times { with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/approve" } }
    assert_response :success
    assert_equal 1, AuditLog.where(event_type: "PAYPAL_CAPTURED", entity_id: @held.id).count
  end

  test "void releases the authorization" do
    login_as users(:admin)
    with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/void" }
    assert_response :success
    assert_equal "VOIDED", @held.reload.paypal_status
    assert AuditLog.exists?(event_type: "PAYPAL_VOIDED", entity_id: @held.id)
  end

  test "refund returns a captured payment and refuses one that was never captured" do
    login_as users(:admin)
    captured = held_payment("CAPTURED")
    with_paypal { post "/api/v1/admin/review_queue/#{captured.id}/refund" }
    assert_response :success
    assert_equal "REFUNDED", captured.reload.paypal_status

    with_paypal { post "/api/v1/admin/review_queue/#{@held.id}/refund" }
    assert_response :conflict
    assert_equal "HELD", @held.reload.paypal_status
  end

  test "voiding a captured payment is a conflict" do
    login_as users(:admin)
    captured = held_payment("CAPTURED")
    with_paypal { post "/api/v1/admin/review_queue/#{captured.id}/void" }
    assert_response :conflict
  end

  test "an unknown transaction is a 404 and a missing PayPal config is a 503" do
    login_as users(:admin)
    with_paypal { post "/api/v1/admin/review_queue/#{SecureRandom.uuid}/approve" }
    assert_response :not_found
    replace_class_method(PaypalClient, :configured?, -> { false }) { post "/api/v1/admin/review_queue/#{@held.id}/approve" }
    assert_response :service_unavailable
  end

  test "an admin settles a held simulated payment without PayPal configured" do
    login_as users(:admin)
    sim = users(:one).transactions.create!(amount: 300, payment_method: "wallet", device_id: "d", status: "FLAGGED", risk_score: 30,
                                           paypal_status: "HELD", paypal_order_id: "SIM-ORDER-1", paypal_authorization_id: "SIM-AUTH-1")
    replace_class_method(PaypalClient, :configured?, -> { false }) do
      post "/api/v1/admin/review_queue/#{sim.id}/approve"
    end
    assert_response :success
    assert_equal "CAPTURED", sim.reload.paypal_status
    assert sim.paypal_capture_id.start_with?("SIM-CAPTURE-")
    assert_equal true, body.dig("data", "simulated")
  end

  test "a real payment still needs PayPal configured" do
    login_as users(:admin)
    replace_class_method(PaypalClient, :configured?, -> { false }) { post "/api/v1/admin/review_queue/#{@held.id}/approve" }
    assert_response :service_unavailable
  end
end
