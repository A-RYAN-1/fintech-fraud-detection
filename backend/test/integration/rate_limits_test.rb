require "test_helper"

class RateLimitsTest < ActionDispatch::IntegrationTest
  setup do
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
  end

  teardown do
    Rack::Attack.cache.store.clear
    Rack::Attack.enabled = false
  end

  def login(email, password = "wrong-password", ip: "10.0.0.1")
    post api_v1_auth_login_url, params: { email: email, password: password }, headers: { "REMOTE_ADDR" => ip }
  end

  test "login is limited per address after twenty attempts, with a JSON 429 and Retry-After" do
    20.times { |i| login("person#{i}@example.com"); assert_response :unauthorized }

    login("person9@example.com")
    assert_response :too_many_requests
    body = JSON.parse(response.body)
    assert_equal "rate_limited", body["error"]
    assert_equal "error", body["status"]
    assert response.headers["Retry-After"].to_i.between?(1, 60)
  end

  test "login is limited per email even when the address changes" do
    5.times { |i| login("target@example.com", ip: "10.0.1.#{i}"); assert_response :unauthorized }

    login("target@example.com", ip: "10.0.1.99")
    assert_response :too_many_requests
    login("other@example.com", ip: "10.0.1.99")
    assert_response :unauthorized
  end

  test "email limit ignores case and spaces" do
    5.times { |i| login(i.even? ? "Target@Example.com" : " target@example.com ", ip: "10.0.2.#{i}") }
    login("TARGET@example.com", ip: "10.0.2.99")
    assert_response :too_many_requests
  end

  test "a different address is not affected by another's limit" do
    20.times { |i| login("a#{i}@example.com") }
    login("a@example.com")
    assert_response :too_many_requests

    login("b@example.com", ip: "10.0.3.1")
    assert_response :unauthorized
  end

  test "payment order creation is limited per signed-in user" do
    user = users(:one)
    login(user.email, "password123", ip: "10.0.4.1")
    assert_response :success

    10.times { post api_v1_paypal_orders_url, params: { amount: "5", device_id: "d1" } }
    assert_not_equal 429, response.status

    post api_v1_paypal_orders_url, params: { amount: "5", device_id: "d1" }
    assert_response :too_many_requests
  end

  test "two signed-in users behind one address have separate payment limits" do
    login(users(:one).email, "password123")
    assert_response :success
    10.times { post api_v1_paypal_orders_url, params: { amount: "5", device_id: "d1" } }
    post api_v1_paypal_orders_url, params: { amount: "5", device_id: "d1" }
    assert_response :too_many_requests

    delete api_v1_auth_logout_url
    Rack::Attack.cache.store.delete("rack::attack:#{Time.now.to_i / 60}:login_ip:10.0.0.1")
    login(users(:reviewer).email, "password123")
    assert_response :success
    post api_v1_paypal_orders_url, params: { amount: "5", device_id: "d2" }
    assert_not_equal 429, response.status
  end

  test "the real client behind Cloudflare is the address that is counted" do
    21.times do |i|
      post api_v1_auth_login_url, params: { email: "p#{i}@example.com", password: "x" },
        headers: { "REMOTE_ADDR" => "172.64.0.#{i + 1}", "X-Forwarded-For" => "203.0.113.7, 172.64.0.#{i + 1}" }
    end
    assert_response :too_many_requests
  end

  test "the health check is never throttled" do
    650.times { get "/up" }
    assert_response :success
  end

  test "rules are off when the limiter is disabled" do
    Rack::Attack.enabled = false
    8.times { login("x@example.com") }
    assert_response :unauthorized
  end
end
