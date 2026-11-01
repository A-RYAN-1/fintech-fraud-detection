require "test_helper"

class AgentPaymentsTest < ActionDispatch::IntegrationTest
  MERCHANT = "Sentrix Demo Store".freeze

  setup do
    RiskRuleConfig.reset_cache!
    @mandate, @token = AgentMandate.issue!(user: users(:one), label: "Shopper", merchant: MERCHANT, per_payment_cap: 100,
                                           total_cap: 150, expires_at: 3.days.from_now)
  end

  def body = JSON.parse(response.body)
  def auth = { "Authorization" => "Bearer #{@token}" }

  def pay(amount, merchant: MERCHANT, headers: auth, **extra)
    post "/api/v1/agent/payments", params: { amount: amount, merchant: merchant, device_id: "agent-runtime-1", **extra }, headers: headers
  end

  test "a payment inside the mandate runs the normal pipeline and uses up part of the cap" do
    assert_difference("Transaction.count", 1) { pay("40", purpose: "Weekly groceries") }
    assert_response :created
    assert_includes %w[captured held voided], body.dig("data", "decision")
    assert_equal true, body.dig("data", "simulated")
    transaction = Transaction.find(body.dig("data", "transaction_id"))
    assert_equal @mandate, transaction.agent_mandate
    assert_equal users(:one), transaction.user
    assert_not_nil transaction.fraud_evaluation
    assert_equal "Weekly groceries", AuditLog.where(event_type: "MANDATE_PAYMENT").last.reason
    spent = @mandate.reload.spent_amount
    assert_equal(body.dig("data", "decision") == "voided" ? 0 : 40, spent)
  end

  test "a payment above the per-payment cap is refused, audited and creates nothing" do
    assert_no_difference("Transaction.count") { pay("100.01") }
    assert_response :forbidden
    assert_equal "over_per_payment_cap", body["error"]
    log = AuditLog.where(event_type: "MANDATE_REFUSED").last
    assert_equal "over_per_payment_cap", log.reason
    assert_equal "system", log.actor_role
    assert_equal 0, @mandate.reload.spent_amount
  end

  test "another merchant is refused" do
    assert_no_difference("Transaction.count") { pay("10", merchant: "Elsewhere Ltd") }
    assert_response :forbidden
    assert_equal "merchant_not_allowed", body["error"]
  end

  test "the total cap holds across payments" do
    2.times { pay("70") }
    assert_response :created
    spent = @mandate.reload.spent_amount
    pay("70")
    if spent == 140
      assert_response :forbidden
      assert_equal "over_total_cap", body["error"]
    else
      assert_response :created # the rules voided an earlier payment, which returns its share of the cap
    end
  end

  test "a payment the rules void gives its share of the cap back" do
    voiding = AgentActionPolicy::Decision.new(action: :void, reason: "Blocked by the risk rules; nothing is charged")
    replace_class_method(AgentActionPolicy, :decide, ->(**) { voiding }) do
      pay("60")
    end
    assert_response :created
    assert_equal "voided", body.dig("data", "decision")
    assert_equal 0, @mandate.reload.spent_amount
  end

  test "a revoked or expired mandate cannot pay" do
    @mandate.revoke!(by: users(:one))
    pay("10")
    assert_response :forbidden
    assert_equal "mandate_revoked", body["error"]

    other, token = AgentMandate.issue!(user: users(:one), label: "Old", merchant: MERCHANT, per_payment_cap: 10, total_cap: 10, expires_at: 1.day.from_now)
    other.update_columns(expires_at: 1.minute.ago)
    pay("5", headers: { "Authorization" => "Bearer #{token}" })
    assert_response :forbidden
    assert_equal "mandate_expired", body["error"]
  end

  test "a missing or wrong token is a 401 and never reaches the pipeline" do
    assert_no_difference([ "Transaction.count", "AuditLog.count" ]) do
      pay("10", headers: {})
      assert_response :unauthorized
      pay("10", headers: { "Authorization" => "Bearer smt_nope" })
      assert_response :unauthorized
    end
    # A browser session is not a mandate: the owner's login does not authorise the agent endpoint.
    post api_v1_auth_login_url, params: { email: users(:one).email, password: "password123" }
    pay("10", headers: {})
    assert_response :unauthorized
  end

  test "the token also works as X-Mandate-Token" do
    pay("10", headers: { "X-Mandate-Token" => @token })
    assert_response :created
  end

  test "a suspended owner stops the agent" do
    users(:one).update!(status: :suspended)
    pay("10")
    assert_response :forbidden
    assert_equal "owner_suspended", body["error"]
  end

  test "the same Idempotency-Key settles one payment and uses the cap once" do
    2.times { pay("30", headers: auth.merge("Idempotency-Key" => "agent-key-1")) }
    assert_equal "true", response.headers["Idempotency-Replayed"]
    assert_equal 1, @mandate.transactions.count
  end

  test "show reports what is left" do
    get "/api/v1/agent/mandate", headers: auth
    assert_response :success
    assert_equal "150.0", body.dig("data", "remaining")
    assert_equal "active", body.dig("data", "status")
  end

  test "amount is validated" do
    [ "0", "-1", "abc", "10001" ].each do |bad|
      pay(bad)
      assert_response :unprocessable_entity, "amount #{bad.inspect} should be rejected"
    end
  end

  test "agent payments are throttled per mandate token" do
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
    # Frozen five seconds into a minute, so the rate-limit window cannot roll over between the eleven requests.
    travel_to(Time.current.beginning_of_minute + 5.seconds) do
      10.times { pay("1") }
      assert_response :created
      pay("1")
      assert_response :too_many_requests
      assert_equal "rate_limited", body["error"]
    end
  ensure
    Rack::Attack.enabled = false
    Rack::Attack.cache.store.clear
  end
end
