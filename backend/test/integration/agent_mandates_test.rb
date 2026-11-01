require "test_helper"

class AgentMandatesTest < ActionDispatch::IntegrationTest
  def body = JSON.parse(response.body)

  def login(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
  end

  def create_mandate(**overrides)
    post "/api/v1/agent_mandates", params: { label: "Shopper", merchant: "Sentrix Demo Store", per_payment_cap: 50, total_cap: 200,
                                             expires_in_days: 5, **overrides }
  end

  test "requires login" do
    get "/api/v1/agent_mandates"
    assert_response :unauthorized
    create_mandate
    assert_response :unauthorized
  end

  test "a customer creates a mandate, sees the token once and the audit trail records it" do
    login(users(:one))
    assert_difference("AgentMandate.count", 1) { create_mandate }
    assert_response :created
    token = body.dig("data", "token")
    assert token.start_with?("smt_")
    assert_equal "active", body.dig("data", "status")
    assert_equal "MANDATE_CREATED", AuditLog.order(:id).last.event_type
    assert_not_includes AuditLog.order(:id).last.after_state.to_s, token

    get "/api/v1/agent_mandates"
    assert_response :success
    assert_nil body.dig("data", "mandates", 0, "token")
    assert_equal 1, body.dig("data", "mandates").size
    assert_equal "mine", body.dig("data", "scope")
  end

  test "invalid caps and a long expiry are rejected or clamped" do
    login(users(:one))
    create_mandate(per_payment_cap: 500, total_cap: 100)
    assert_response :unprocessable_entity
    create_mandate(per_payment_cap: 0)
    assert_response :unprocessable_entity
    create_mandate(expires_in_days: 999)
    assert_response :created
    assert_operator AgentMandate.last.expires_at, :<=, 31.days.from_now
  end

  test "a customer sees only their own mandates and cannot revoke another's" do
    mine, = AgentMandate.issue!(user: users(:one), label: "Mine", merchant: "m", per_payment_cap: 5, total_cap: 5, expires_at: 2.days.from_now)
    theirs, = AgentMandate.issue!(user: users(:reviewer), label: "Theirs", merchant: "m", per_payment_cap: 5, total_cap: 5, expires_at: 2.days.from_now)
    login(users(:one))
    get "/api/v1/agent_mandates"
    assert_equal [ mine.id ], body.dig("data", "mandates").map { |m| m["id"] }

    post "/api/v1/agent_mandates/#{theirs.id}/revoke"
    assert_response :forbidden
    assert_not theirs.reload.revoked?
  end

  test "the owner revokes and the agent is stopped at once" do
    login(users(:one))
    create_mandate
    id = body.dig("data", "id")
    token = body.dig("data", "token")
    post "/api/v1/agent_mandates/#{id}/revoke"
    assert_response :success
    assert_equal "revoked", body.dig("data", "status")
    event = AuditLog.where(event_type: "MANDATE_REVOKED").last
    assert_equal({ "status" => "active" }, event.before_state)

    delete api_v1_auth_logout_url
    post "/api/v1/agent/payments", params: { amount: 5, merchant: "Sentrix Demo Store", device_id: "d" }, headers: { "Authorization" => "Bearer #{token}" }
    assert_response :forbidden
    assert_equal "mandate_revoked", body["error"]
  end

  test "staff see every mandate and can revoke any" do
    mandate, = AgentMandate.issue!(user: users(:one), label: "Mine", merchant: "m", per_payment_cap: 5, total_cap: 5, expires_at: 2.days.from_now)
    login(users(:admin))
    get "/api/v1/agent_mandates"
    assert_equal "all", body.dig("data", "scope")
    assert_equal users(:one).email, body.dig("data", "mandates", 0, "owner_email")
    post "/api/v1/agent_mandates/#{mandate.id}/revoke"
    assert_response :success
    assert_equal users(:admin), mandate.reload.revoked_by
  end

  test "revoking an unknown mandate is a 404" do
    login(users(:one))
    post "/api/v1/agent_mandates/0/revoke"
    assert_response :not_found
  end
end
