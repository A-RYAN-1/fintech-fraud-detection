require "test_helper"

class FeedbackTest < ActionDispatch::IntegrationTest
  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
  end

  def labelled_payment(status:, label:)
    payment = users(:one).transactions.create!(amount: 50, payment_method: "wallet", device_id: "d", status: status, paypal_status: "CAPTURED")
    FraudEvaluation.create!(financial_transaction: payment, risk_score: 40, ml_score: 0.0, human_label: label, label_source: "decision",
                            labeled_by: users(:reviewer), labeled_at: Time.current)
  end

  test "requires a session" do
    get "/api/v1/admin/feedback"
    assert_response :unauthorized
  end

  test "a customer is refused" do
    login_as(users(:one))
    get "/api/v1/admin/feedback"
    assert_response :forbidden
  end

  test "staff see the summary and the disagreements" do
    labelled_payment(status: "FLAGGED", label: "approve")
    login_as(users(:analyst))
    get "/api/v1/admin/feedback"
    assert_response :success
    data = JSON.parse(response.body)["data"]
    assert_equal 1, data["labelled"]
    assert_equal 1, data["human_approve"]
    assert_equal %w[ai ml rules], data["signals"].keys.sort
    assert_equal 1, data["signals"]["rules"]["false_alarms"]
    assert_equal 1, data["disagreements"].size
    assert_equal [ "rules" ], data["disagreements"].first["disagreeing"]
    assert_equal 1, data["meta"]["total_count"]
  end

  test "the signal filter narrows the list and an unknown signal is 422" do
    labelled_payment(status: "FLAGGED", label: "approve")
    login_as(users(:reviewer))
    get "/api/v1/admin/feedback", params: { signal: "ml" }
    assert_equal 0, JSON.parse(response.body)["data"]["disagreements"].size
    get "/api/v1/admin/feedback", params: { signal: "bogus" }
    assert_response :unprocessable_entity
  end
end
