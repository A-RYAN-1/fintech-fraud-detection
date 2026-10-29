require "test_helper"

class PaymentLimitsControllerTest < ActionDispatch::IntegrationTest
  test "rejects anonymous callers" do
    get api_v1_payment_limits_url
    assert_response :unauthorized
  end

  test "returns the admin-set limits to a customer" do
    post api_v1_auth_login_url, params: { email: users(:one).email, password: "password123" }
    get api_v1_payment_limits_url
    assert_response :success
    data = JSON.parse(response.body)["data"]
    assert_equal RiskRuleConfig.get(:max_auto_capture_amount).to_f, data["max_auto_capture_amount"]
    assert_equal RiskRuleConfig.get(:daily_auto_capture_cap).to_f, data["daily_auto_capture_cap"]
  end
end
