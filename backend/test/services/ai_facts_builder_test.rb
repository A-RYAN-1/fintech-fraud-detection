require "test_helper"

class AiFactsBuilderTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @stats = user_transaction_stats(:one)
    @device = devices(:one)
  end

  def facts_for(transaction, status: :success, triggered: [])
    rules = { status: status, risk_score: 0, triggered_rules: triggered }
    AiFactsBuilder.new(transaction, @user, @stats, rules).facts
  end

  test "carries bands and flags and nothing that identifies the user or the device" do
    transaction = Transaction.create!(amount: 1001, payment_method: "card", device_id: @device.device_id, ip_address: "203.0.113.9", user: @user)
    facts = facts_for(transaction, status: :flagged, triggered: [ "AMOUNT_DEVIATION_HIGH" ])
    text = facts.to_json

    assert_equal "1,000 to 5,000", facts[:amount_band_usd]
    assert_equal "review", facts[:rules_decision]
    assert_equal [ "AMOUNT_DEVIATION_HIGH" ], facts[:rules_triggered]
    assert_equal "trusted", facts[:device]
    assert_not_includes text, @device.device_id
    assert_not_includes text, "203.0.113.9"
    assert_not_includes text, @user.email
    assert_not_includes text, transaction.id.to_s
  end

  test "marks a different or missing device" do
    other = Transaction.create!(amount: 20, payment_method: "card", device_id: "some-other-device", user: @user)
    assert_equal "different from the trusted device", facts_for(other)[:device]

    none = Transaction.new(amount: 20, payment_method: "card", device_id: nil, user: @user, created_at: Time.current)
    assert_equal "missing", facts_for(none)[:device]
  end

  test "includes the model reasons as labels when the model ran" do
    transaction = Transaction.create!(amount: 100, payment_method: "card", device_id: @device.device_id, user: @user)
    rules = { status: :success, risk_score: 0, triggered_rules: [], ml: { probability: 0.1234, reasons: [ { feature: "night", label: "Night-time transaction (00:00 to 06:00 UTC)", contribution: 0.4 } ] } }
    facts = AiFactsBuilder.new(transaction, @user, @stats, rules).facts

    assert_equal 0.12, facts[:model_risk_probability]
    assert_equal [ "Night-time transaction (00:00 to 06:00 UTC)" ], facts[:model_top_reasons]
  end
end
