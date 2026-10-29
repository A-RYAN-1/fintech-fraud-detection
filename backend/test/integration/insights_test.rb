require "test_helper"

class InsightsTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
    threshold = MlRiskScorer.model.fetch("flag_threshold")
    @high = threshold + 0.01
    @low = [ threshold - 0.01, 0 ].max
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def data
    JSON.parse(response.body)["data"]
  end

  def payment(status:, paypal:, amount: 100, at: 1.hour.ago, risk: 10, rules: "", ml: nil, ai: nil, decided_after: nil)
    t = Transaction.create!(user: @customer, amount: amount, status: status, paypal_status: paypal, device_id: "d",
                            risk_score: risk, created_at: at)
    FraudEvaluation.create!(transaction_id: t.id, risk_score: risk, rules_triggered: rules, ml_score: ml,
                            ai_verdict: ai && { "action" => ai },
                            human_label: decided_after && "approve", label_source: decided_after && "decision",
                            labeled_at: decided_after && at + decided_after)
    t
  end

  def seed
    payment(status: "SUCCESS", paypal: "CAPTURED", amount: 40, ml: @low, ai: "approve")
    payment(status: "BLOCKED", paypal: "VOIDED", amount: 900, risk: 80, rules: "AMOUNT_DEVIATION_HIGH,UNTRUSTED_DEVICE", ml: @high)
    payment(status: "FLAGGED", paypal: "CAPTURED", amount: 300, risk: 35, rules: "UNTRUSTED_DEVICE", ml: @low, ai: "review",
            decided_after: 10.minutes, at: 2.days.ago)
    payment(status: "FLAGGED", paypal: "HELD", amount: 1100, risk: 30, rules: "ML_RISK_SCORE", ml: @high, ai: "block")
    payment(status: "SUCCESS", paypal: "CAPTURED", amount: 60, decided_after: 30.minutes, at: 3.days.ago)
    payment(status: "SUCCESS", paypal: "CAPTURED", amount: 5000, at: 20.days.ago)
    Transaction.create!(user: @customer, amount: 7, status: "SUCCESS", device_id: "d", created_at: 1.hour.ago) # no PayPal
  end

  test "staff see every PayPal payment in the period, counts and amounts only" do
    seed
    login_as users(:analyst)
    get api_v1_admin_insights_url
    assert_response :success
    assert_equal 7, data["period_days"]
    totals = data["totals"]
    assert_equal 5, totals["payments"]
    assert_equal 2400.0, totals["volume"]
    assert_equal [ 3, 1, 1, 1 ], totals.values_at("captured", "held", "voided", "blocked_by_rules")
    assert_equal 7, data["daily"].size
    assert_equal 5, data["daily"].sum { |d| d["payments"] }
    assert_equal [ 2, 2, 0, 1 ], data["risk_ranges"].map { |r| r["count"] }
    assert_equal({ "rule" => "UNTRUSTED_DEVICE", "count" => 2 }, data["top_rules"].first)
    assert_equal({ "scored" => 4, "flagged" => 2, "flag_rate" => 0.5 }, data["model"])
    assert_equal({ "read" => 3, "approve" => 1, "review" => 1, "block" => 1 }, data["ai"])
    assert_equal 2, data["decision_time"]["decided"]
    assert_equal 10.0, data["decision_time"]["median_minutes"]
    assert_equal 30.0, data["decision_time"]["p90_minutes"]
    refute_includes response.body, @customer.email
  end

  test "a longer period includes older payments" do
    seed
    login_as users(:reviewer)
    get api_v1_admin_insights_url, params: { period: "30d" }
    assert_equal 6, data["totals"]["payments"]
    assert_equal 30, data["daily"].size
  end

  test "an empty period has nil rates, not errors" do
    login_as users(:admin)
    get api_v1_admin_insights_url
    assert_response :success
    assert_nil data["model"]["flag_rate"]
    assert_nil data["decision_time"]["median_minutes"]
  end

  test "customers are refused and a bad period is rejected" do
    login_as @customer
    get api_v1_admin_insights_url
    assert_response :forbidden

    login_as users(:admin)
    get api_v1_admin_insights_url, params: { period: "1y" }
    assert_response :unprocessable_entity
  end
end
