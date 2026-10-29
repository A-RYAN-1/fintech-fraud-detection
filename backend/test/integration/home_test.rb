require "test_helper"

class HomeTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
    @other = User.create!(email: "other@example.com", first_name: "O", last_name: "C", password: "password123")
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def data
    JSON.parse(response.body)["data"]
  end

  def payment(user, status:, paypal:, rules: "", ai: nil, label: nil, at: 1.hour.ago, amount: 50)
    t = Transaction.create!(user: user, amount: amount, status: status, paypal_status: paypal, device_id: "d1",
                            created_at: at, risk_score: 10)
    FraudEvaluation.create!(transaction_id: t.id, risk_score: 10, rules_triggered: rules,
                            ai_verdict: ai && { "action" => ai }, human_label: label)
    t
  end

  def seed_traffic
    payment(@customer, status: "SUCCESS", paypal: "CAPTURED", ai: "approve")
    payment(@customer, status: "BLOCKED", paypal: "VOIDED")
    payment(@customer, status: "FLAGGED", paypal: "HELD", rules: "UNTRUSTED_DEVICE", at: 3.hours.ago, amount: 1100)
    payment(@other, status: "FLAGGED", paypal: "CAPTURED", rules: "ML_RISK_SCORE", label: "approve")
    payment(@other, status: "SUCCESS", paypal: "HELD", ai: "review", at: 2.hours.ago)
    payment(@other, status: "SUCCESS", paypal: "REFUNDED", at: 10.days.ago)
    Transaction.create!(user: @customer, amount: 5, status: "PENDING", paypal_status: "CREATED", device_id: "d1") # never approved
  end

  test "a customer sees only their own payments and is told to wait on a held one" do
    seed_traffic
    login_as @customer
    get api_v1_home_url
    assert_response :success
    assert_equal "own", data["scope"]
    pipeline = data["pipeline"]
    assert_equal 3, pipeline["authorized"]
    assert_equal 1, pipeline["rules_blocked"]
    assert_equal 1, pipeline["rules_flagged"]
    assert_equal 0, pipeline["model_flagged"]
    assert_equal [ 1, 1, 1 ], pipeline.values_at("captured", "held", "voided")
    assert_equal "wait", data["next_step"]["kind"]
    assert_equal 1100.0, data["next_step"]["latest"]["amount"]
  end

  test "a customer with no payments is pointed at Pay" do
    login_as @other.tap { |u| u.transactions.destroy_all }
    get api_v1_home_url
    assert_equal({ "kind" => "pay", "count" => 0 }, data["next_step"])
  end

  test "staff see all payments of the last 7 days and the oldest held one" do
    seed_traffic
    login_as users(:reviewer)
    get api_v1_home_url
    assert_equal "all", data["scope"]
    assert_equal 7, data["window_days"]
    pipeline = data["pipeline"]
    assert_equal 5, pipeline["authorized"], "the 10-day-old refund is outside the window"
    assert_equal 1, pipeline["model_flagged"]
    assert_equal 1, pipeline["rules_flagged"]
    assert_equal 2, pipeline["ai_read"]
    assert_equal 1, pipeline["ai_escalated"]
    assert_equal 1, pipeline["human_decided"]
    assert_equal 0, pipeline["refunded"]
    step = data["next_step"]
    assert_equal "review", step["kind"]
    assert_equal 2, step["count"]
    assert_equal 1100.0, step["oldest"]["amount"]
    assert_nil step["oldest"]["email"]
  end

  test "an admin starts at pending approvals, then the queue" do
    seed_traffic
    login_as users(:admin)
    get api_v1_home_url
    assert_equal "review", data["next_step"]["kind"]

    held = Transaction.find_by(paypal_status: "HELD", user: @other)
    ApprovalRequest.create!(payment: held, action: "approve", requested_by: users(:reviewer))
    get api_v1_home_url
    assert_equal "approvals", data["next_step"]["kind"]
    assert_equal 1, data["next_step"]["count"]
    assert_equal "approve", data["next_step"]["oldest"]["action"]
  end

  test "an empty queue says so" do
    login_as users(:analyst)
    get api_v1_home_url
    assert_equal({ "kind" => "queue_empty", "count" => 0 }, data["next_step"])
  end

  test "home needs a session" do
    get api_v1_home_url
    assert_response :unauthorized
  end
end
