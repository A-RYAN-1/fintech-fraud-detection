require "test_helper"

class AnalyticsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    post api_v1_auth_login_url, params: { email: @user.email, password: 'password123' }
  end

  test "should get analytics" do
    get api_v1_analytics_url, params: { period: '7d' }
    assert_response :success
    json_response = JSON.parse(response.body)
    assert_equal "success", json_response["status"]
    assert_not_nil json_response["data"]["stats"]
  end

  test "a customer sees only their own transactions and volume" do
    other = users(:admin)
    other.transactions.create!(
      amount: 9999.0, payment_method: "card", status: :success,
      risk_score: 5, device_id: "other-device", ip_address: "127.0.0.2"
    )
    own = @user.transactions.count

    get api_v1_analytics_url, params: { period: "all" }

    stats = JSON.parse(response.body)["data"]["stats"]
    assert_equal own, stats["total_transactions"]
    assert_equal @user.transactions.where(status: [ :success, :flagged ]).sum(:amount).to_f,
                 stats["total_volume"]
    assert_operator stats["total_volume"], :<, 9999.0
  end
end
