require "test_helper"

class RuleProposalsTest < ActionDispatch::IntegrationTest
  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
  end

  setup do
    RiskRuleConfig.reset_cache!
    @proposal = RuleProposal.create!(key: "flag_threshold", current_value: 30, proposed_value: 51, trigger_kind: "false_alarm",
                                     rationale: "A reviewer approved a flagged payment.", backtest: { "replayed" => 5, "delta" => { "false_alarms" => -1, "misses" => 0 } })
  end

  teardown { RiskRuleConfig.reset_cache! }

  test "requires a session and refuses customers" do
    get "/api/v1/admin/rule_proposals"
    assert_response :unauthorized
    login_as(users(:one))
    get "/api/v1/admin/rule_proposals"
    assert_response :forbidden
  end

  test "staff read pending drafts with the backtest and live value" do
    login_as(users(:analyst))
    get "/api/v1/admin/rule_proposals"
    assert_response :success
    row = JSON.parse(response.body)["data"]["rule_proposals"].first
    assert_equal "flag_threshold", row["key"]
    assert_equal 51.0, row["proposed_value"]
    assert_equal 30.0, row["live_value"]
    assert_equal(-1, row["backtest"]["delta"]["false_alarms"])
    get "/api/v1/admin/rule_proposals", params: { status: "bogus" }
    assert_response :unprocessable_entity
  end

  test "only an admin accepts, and accepting changes the live rule with an audit row" do
    login_as(users(:reviewer))
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/accept", headers: { "Idempotency-Key" => "k0" }
    assert_response :forbidden
    assert_equal 30, RiskRuleConfig.get("flag_threshold")

    login_as(users(:admin))
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/accept", params: { note: "reviewed the flips" }, headers: { "Idempotency-Key" => "k1" }
    assert_response :success
    RiskRuleConfig.reset_cache!
    assert_equal 51, RiskRuleConfig.get("flag_threshold")
    assert @proposal.reload.accepted?
    assert_equal users(:admin), @proposal.decided_by
    log = AuditLog.find_by(event_type: "RISK_RULE_CHANGED", entity_id: "flag_threshold")
    assert_equal users(:admin), log.actor
    assert_equal "reviewed the flips", log.reason
  end

  test "a draft is stale once the rule changed, and is marked superseded" do
    RiskRuleSetting.create!(key: "flag_threshold", value: 40)
    RiskRuleConfig.reset_cache!
    login_as(users(:admin))
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/accept", headers: { "Idempotency-Key" => "k2" }
    assert_response :conflict
    assert @proposal.reload.superseded?
    assert_equal 40, RiskRuleConfig.get("flag_threshold")
  end

  test "an accept that breaks the ordering rule is refused and changes nothing" do
    @proposal.update!(proposed_value: 90)
    login_as(users(:admin))
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/accept", headers: { "Idempotency-Key" => "k3" }
    assert_response :unprocessable_entity
    assert @proposal.reload.pending?
    assert_equal 30, RiskRuleConfig.get("flag_threshold")
  end

  test "reject leaves the rule alone and a settled draft cannot be settled again" do
    login_as(users(:admin))
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/reject", params: { note: "too loose" }, headers: { "Idempotency-Key" => "k4" }
    assert_response :success
    assert @proposal.reload.rejected?
    assert_equal 30, RiskRuleConfig.get("flag_threshold")
    post "/api/v1/admin/rule_proposals/#{@proposal.id}/accept", headers: { "Idempotency-Key" => "k5" }
    assert_response :conflict
  end

  test "staff can ask for a draft from a decided payment, and get the reason when none exists" do
    payment = users(:one).transactions.create!(amount: 50, payment_method: "wallet", device_id: "d", status: "SUCCESS", risk_score: 0)
    FraudEvaluation.create!(financial_transaction: payment, risk_score: 0, human_label: "approve", label_source: "decision", labeled_by: users(:reviewer), labeled_at: Time.current)
    login_as(users(:analyst))
    post "/api/v1/admin/rule_proposals", params: { transaction_id: payment.id }
    assert_response :unprocessable_entity
    assert_match(/agreed/, response.body)
    post "/api/v1/admin/rule_proposals", params: { transaction_id: SecureRandom.uuid }
    assert_response :not_found
  end
end
