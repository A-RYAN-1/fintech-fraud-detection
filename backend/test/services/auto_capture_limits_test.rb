require "test_helper"

class AutoCaptureLimitsTest < ActiveSupport::TestCase
  setup do
    RiskRuleConfig.reset_cache!
    @user = users(:one)
  end

  teardown { RiskRuleConfig.reset_cache! }

  def captured(amount, mode: "auto", at: Time.current)
    @user.transactions.create!(amount: amount, payment_method: "wallet", device_id: "d", paypal_status: "CAPTURED",
                               paypal_capture_mode: mode, paypal_captured_at: at)
  end

  test "defaults are 1000 per payment and 5000 per day" do
    assert_equal 1_000, RiskRuleConfig.get(:max_auto_capture_amount)
    assert_equal 5_000, RiskRuleConfig.get(:daily_auto_capture_cap)
  end

  test "a payment exactly at the per-payment limit fits, one cent above breaks it" do
    assert_nil AutoCaptureLimits.breach(BigDecimal("1000"))
    assert_match(/above the auto-capture limit/, AutoCaptureLimits.breach(BigDecimal("1000.01")))
  end

  test "the daily cap is reached exactly without breaching, one cent over breaches" do
    captured(4_000)
    assert_nil AutoCaptureLimits.breach(BigDecimal("1000"))
    captured(0.01)
    assert_match(/daily cap/, AutoCaptureLimits.breach(BigDecimal("1000")))
  end

  test "payments a human approved and earlier days do not count" do
    captured(4_500, mode: "human")
    captured(4_500, at: Time.current.utc.beginning_of_day - 1.second)
    assert_equal 0, AutoCaptureLimits.captured_today
    assert_nil AutoCaptureLimits.breach(BigDecimal("1000"))
  end

  test "the limits follow the admin settings" do
    RiskRuleSetting.create!(key: "max_auto_capture_amount", value: 50)
    RiskRuleConfig.reset_cache!
    assert_nil AutoCaptureLimits.breach(BigDecimal("50"))
    assert_not_nil AutoCaptureLimits.breach(BigDecimal("50.01"))
  end

  test "limits are range checked like every other rule" do
    assert_not RiskRuleSetting.new(key: "max_auto_capture_amount", value: 0).valid?
    assert_not RiskRuleSetting.new(key: "daily_auto_capture_cap", value: 10_000_001).valid?
    assert RiskRuleSetting.new(key: "daily_auto_capture_cap", value: 20_000).valid?
  end
end
