require "test_helper"

class RiskRulesApiTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @manager = users(:manager)
    @customer = users(:one)
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def body
    JSON.parse(response.body)
  end

  def rule(key)
    body["data"]["risk_rules"].find { |r| r["key"] == key }
  end

  # Access control

  test "risk rule routes require a session" do
    get api_v1_admin_risk_rules_url
    assert_response :unauthorized
    patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 80 }
    assert_response :unauthorized
    post reset_api_v1_admin_risk_rules_url
    assert_response :unauthorized
  end

  test "a customer cannot read or change rules" do
    login_as @customer
    get api_v1_admin_risk_rules_url
    assert_response :forbidden
    patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 80 }
    assert_response :forbidden
  end

  test "a manager can read rules but not change or reset them" do
    login_as @manager
    get api_v1_admin_risk_rules_url
    assert_response :success
    patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 80 }
    assert_response :forbidden
    post reset_api_v1_admin_risk_rules_url
    assert_response :forbidden
    assert_equal 0, RiskRuleSetting.count
  end

  # Reading

  test "the list shows every key with value, default and limits" do
    login_as @admin
    get api_v1_admin_risk_rules_url
    assert_response :success
    assert_equal RiskRuleConfig::DEFINITIONS.keys, body["data"]["risk_rules"].map { |r| r["key"] }
    block = rule("block_threshold")
    assert_equal %w[default description key max min value whole_number], block.keys.sort
    assert_equal 70, block["value"]
    assert_equal 70, block["default"]
  end

  # Changing

  test "admin changes a value and the change is audit-logged with old and new" do
    login_as @admin
    assert_difference("AuditLog.count", 1) do
      patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 80 }
    end
    assert_response :success
    assert_equal 80, body["data"]["value"]
    assert_equal @admin, RiskRuleSetting.find_by!(key: "block_threshold").updated_by

    log = AuditLog.order(:created_at).last
    assert_equal "RISK_RULE_CHANGED", log.event_type
    assert_equal "block_threshold", log.entity_id
    assert_includes log.description, "from 70 to 80"
    assert_includes log.description, @admin.email

    get api_v1_admin_risk_rules_url
    assert_equal 80, rule("block_threshold")["value"]
  end

  test "setting the same value writes no audit entry" do
    login_as @admin
    assert_no_difference("AuditLog.count") do
      patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 70 }
    end
    assert_response :success
  end

  test "invalid values are rejected with 422 and change nothing" do
    login_as @admin
    {
      "block_threshold" => [ "abc", "", "0", "500", "70.5", "25" ],
      "deviation_multiplier_high" => [ "1.5" ],
      "large_amount_min" => [ "500" ]
    }.each do |key, values|
      values.each do |value|
        assert_no_difference([ "AuditLog.count", "RiskRuleSetting.count" ]) do
          patch api_v1_admin_risk_rule_url(key), params: { value: value }
        end
        assert_response :unprocessable_entity, "#{key}=#{value.inspect} should be rejected"
      end
    end
  end

  test "an unknown key is not found" do
    login_as @admin
    patch api_v1_admin_risk_rule_url("made_up"), params: { value: 5 }
    assert_response :not_found
  end

  test "multipliers keep their order" do
    login_as @admin
    patch api_v1_admin_risk_rule_url("deviation_multiplier_low"), params: { value: 6 }
    assert_response :unprocessable_entity
    patch api_v1_admin_risk_rule_url("deviation_multiplier_high"), params: { value: 4 }
    assert_response :unprocessable_entity
    patch api_v1_admin_risk_rule_url("deviation_multiplier_high"), params: { value: 20 }
    assert_response :success
  end

  # Reset

  test "reset restores every default and logs one entry" do
    login_as @admin
    patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 90 }
    patch api_v1_admin_risk_rule_url("missing_device_risk"), params: { value: 10 }

    assert_difference("AuditLog.count", 1) do
      post reset_api_v1_admin_risk_rules_url
    end
    assert_response :success
    assert_equal "RISK_RULES_RESET", AuditLog.order(:created_at).last.event_type
    assert_equal 70, rule("block_threshold")["value"]
    assert_equal 50, rule("missing_device_risk")["value"]
  end

  test "reset with nothing changed writes no audit entry" do
    login_as @admin
    assert_no_difference("AuditLog.count") { post reset_api_v1_admin_risk_rules_url }
    assert_response :success
  end

  # Effect on scoring

  test "raising the block threshold turns a blocked transaction into a flagged one" do
    login_as @admin
    transaction = ->(id) { Transaction.create!(amount: 1001, payment_method: "card", device_id: "untrusted_#{id}", user: @customer) }

    assert_equal :blocked, TransactionRiskEvaluator.new(transaction.call(1)).evaluate

    patch api_v1_admin_risk_rule_url("block_threshold"), params: { value: 90 }
    assert_response :success

    RiskRuleConfig.reset_cache! # the cache lives for one request; this test scores outside the request
    assert_equal :flagged, TransactionRiskEvaluator.new(transaction.call(2)).evaluate
  end
end
