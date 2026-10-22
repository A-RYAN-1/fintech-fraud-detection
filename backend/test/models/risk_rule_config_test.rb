require "test_helper"

class RiskRuleConfigTest < ActiveSupport::TestCase
  setup { RiskRuleConfig.reset_cache! }
  teardown { RiskRuleConfig.reset_cache! }

  test "a missing row falls back to the default" do
    assert_equal 0, RiskRuleSetting.count
    assert_equal 70, RiskRuleConfig.get(:block_threshold)
    assert_equal 60, RiskRuleConfig.get("velocity_window_seconds")
  end

  test "a stored row overrides the default" do
    RiskRuleSetting.create!(key: "block_threshold", value: 85)
    assert_equal 85, RiskRuleConfig.get(:block_threshold)
    assert_equal 30, RiskRuleConfig.get(:flag_threshold)
  end

  test "values are loaded once until the cache is reset" do
    RiskRuleSetting.create!(key: "block_threshold", value: 85)
    assert_equal 85, RiskRuleConfig.get(:block_threshold)

    RiskRuleSetting.find_by!(key: "block_threshold").update_columns(value: 95)
    assert_equal 85, RiskRuleConfig.get(:block_threshold)

    RiskRuleConfig.reset_cache!
    assert_equal 95, RiskRuleConfig.get(:block_threshold)
  end

  test "an unknown key is rejected" do
    assert_not RiskRuleSetting.new(key: "nope", value: 1).valid?
  end

  test "a duplicate key is rejected" do
    RiskRuleSetting.create!(key: "block_threshold", value: 80)
    assert_not RiskRuleSetting.new(key: "block_threshold", value: 81).valid?
  end

  test "flag threshold must stay below block threshold" do
    assert_not RiskRuleSetting.new(key: "flag_threshold", value: 70).valid?
    assert RiskRuleSetting.new(key: "flag_threshold", value: 69).valid?
    assert_not RiskRuleSetting.new(key: "block_threshold", value: 30).valid?
  end

  test "amount bounds keep their order" do
    assert_not RiskRuleSetting.new(key: "very_large_amount_min", value: 10_000).valid?
    assert RiskRuleSetting.new(key: "very_large_amount_min", value: 10_001).valid?
  end
end
