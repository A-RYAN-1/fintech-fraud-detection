require "test_helper"

class SpendingTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
    @other = User.create!(email: "other.spender@example.com", first_name: "O", last_name: "S", password: "password123")
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def data
    JSON.parse(response.body)["data"]
  end

  def payment(user, paypal:, amount:, rules: "", refunded: 0, at: 1.hour.ago)
    t = Transaction.create!(user: user, amount: amount, status: "SUCCESS", paypal_status: paypal, device_id: "d",
                            refunded_amount: refunded, created_at: at)
    FraudEvaluation.create!(transaction_id: t.id, risk_score: 10, rules_triggered: rules)
  end

  test "a customer sees only their own captured, held and voided money and why" do
    payment(@customer, paypal: "CAPTURED", amount: 100)
    payment(@customer, paypal: "PARTIALLY_REFUNDED", amount: 50, refunded: 20)
    payment(@customer, paypal: "HELD", amount: 1100, rules: "UNTRUSTED_DEVICE")
    payment(@customer, paypal: "VOIDED", amount: 2500, rules: "AMOUNT_DEVIATION_HIGH,UNTRUSTED_DEVICE")
    payment(@customer, paypal: "CAPTURED", amount: 999, at: 40.days.ago)
    payment(@other, paypal: "CAPTURED", amount: 777)

    login_as @customer
    get api_v1_spending_url
    assert_response :success
    assert_equal 30, data["period_days"]
    assert_equal 130.0, data["spent"]
    assert_equal 2, data["captured_count"]
    assert_equal({ "count" => 1, "amount" => 1100.0 }, data["held"])
    assert_equal({ "count" => 1, "amount" => 2500.0 }, data["voided"])
    assert_equal 30, data["daily"].size
    assert_equal 130.0, data["daily"].last["spent"]
    assert_equal [ { "rule" => "UNTRUSTED_DEVICE", "count" => 2 }, { "rule" => "AMOUNT_DEVIATION_HIGH", "count" => 1 } ], data["reasons"]
  end

  test "staff are sent to Insights and a bad period is rejected" do
    login_as users(:reviewer)
    get api_v1_spending_url
    assert_response :forbidden

    login_as @customer
    get api_v1_spending_url, params: { period: "all" }
    assert_response :unprocessable_entity
  end
end
