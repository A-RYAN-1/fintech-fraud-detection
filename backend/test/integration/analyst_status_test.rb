require "test_helper"

class AnalystStatusTest < ActionDispatch::IntegrationTest
  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
  end

  test "requires a session" do
    get "/api/v1/admin/analyst_status"
    assert_response :unauthorized
  end

  test "a customer is refused" do
    login_as(users(:one))
    get "/api/v1/admin/analyst_status"
    assert_response :forbidden
  end

  test "staff see the breaker and bucket state" do
    login_as(users(:manager))
    AnalystGuard.instance.acquire
    get "/api/v1/admin/analyst_status"
    assert_response :success
    data = JSON.parse(response.body)["data"]
    assert_equal "closed", data["state"]
    assert_equal 1, data["calls"]
    assert_equal 9, data["tokens"]
    assert_equal 10, data["capacity"]
    assert data.key?("model")
  end
end
