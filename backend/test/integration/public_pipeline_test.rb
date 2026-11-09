require "test_helper"

class PublicPipelineTest < ActionDispatch::IntegrationTest
  setup { Rails.cache.clear }

  def payment(status:, paypal:, at: 1.hour.ago)
    t = Transaction.create!(user: users(:one), amount: 50, status: status, paypal_status: paypal, device_id: "d1",
                            created_at: at, risk_score: 10)
    FraudEvaluation.create!(transaction_id: t.id, risk_score: 10, rules_triggered: "")
    t
  end

  test "anyone gets the last 7 days of pipeline counts without signing in" do
    payment(status: "SUCCESS", paypal: "CAPTURED")
    payment(status: "FLAGGED", paypal: "HELD")
    payment(status: "SUCCESS", paypal: "CAPTURED", at: 10.days.ago)

    get "/api/v1/public/pipeline"

    assert_response :success
    data = JSON.parse(response.body)["data"]
    assert_equal 7, data["window_days"]
    assert_equal 2, data["pipeline"]["authorized"]
    assert_equal 1, data["pipeline"]["captured"]
    assert_equal 1, data["pipeline"]["held"]
  end

  test "the answer holds counts only, never a person or an amount" do
    payment(status: "FLAGGED", paypal: "HELD")

    get "/api/v1/public/pipeline"

    body = response.body
    assert_no_match(/@/, body)
    assert_no_match(/50\.0/, body)
    assert(JSON.parse(body)["data"]["pipeline"].values.all? { |v| v.is_a?(Integer) })
  end
end
