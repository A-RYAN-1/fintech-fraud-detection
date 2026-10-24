require "test_helper"

class PaypalOrdersTest < ActionDispatch::IntegrationTest
  class FakeClient
    def create_order(amount:, currency:, reference:, **) = { "id" => "ORDER-#{reference.to_s.first(8)}" }
    def authorize_order(_id, **) = { "id" => "AUTH-1" }
    def capture(_id, **) = { "id" => "CAP-1" }
    def void(_id, **) = {}
  end

  setup do
    post api_v1_auth_login_url, params: { email: users(:one).email, password: "password123" }
  end

  def with_paypal(&block)
    replace_class_method(PaypalClient, :configured?, -> { true }) do
      replace_class_method(PaypalClient, :new, ->(*) { FakeClient.new }, &block)
    end
  end

  test "requires login" do
    delete api_v1_auth_logout_url
    post "/api/v1/paypal/orders", params: { amount: 10, device_id: "d" }
    assert_response :unauthorized
  end

  test "answers 503 when PayPal is not configured" do
    replace_class_method(PaypalClient, :configured?, -> { false }) do
      post "/api/v1/paypal/orders", params: { amount: 10, device_id: "d" }
    end
    assert_response :service_unavailable
  end

  test "creates an order and returns its id" do
    with_paypal do
      assert_difference("Transaction.count") { post "/api/v1/paypal/orders", params: { amount: "19.99", device_id: "browser-1" } }
    end
    assert_response :created
    assert JSON.parse(response.body).dig("data", "order_id").start_with?("ORDER-")
  end

  test "rejects amounts that are zero, negative, too large or not numbers" do
    with_paypal do
      [ "0", "-5", "10001", "abc" ].each do |bad|
        post "/api/v1/paypal/orders", params: { amount: bad, device_id: "d" }
        assert_response :unprocessable_entity, "amount #{bad.inspect} should be rejected"
      end
    end
  end

  test "authorize scores the payment and returns the decision" do
    with_paypal do
      post "/api/v1/paypal/orders", params: { amount: 10, device_id: "browser-1" }
      order_id = JSON.parse(response.body).dig("data", "order_id")
      post "/api/v1/paypal/orders/#{order_id}/authorize"
    end
    assert_response :success
    data = JSON.parse(response.body)["data"]
    assert_includes %w[captured held voided], data["decision"]
    assert_equal data["decision"], { "CAPTURED" => "captured", "HELD" => "held", "VOIDED" => "voided" }[data["paypal_status"]]
  end

  test "authorize of an unknown order is a 404" do
    with_paypal { post "/api/v1/paypal/orders/NOPE/authorize" }
    assert_response :not_found
  end
end
