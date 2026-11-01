require "test_helper"

class PaypalWebhooksTest < ActionDispatch::IntegrationTest
  def body = JSON.parse(response.body)

  def post_event(payload, headers: {})
    post "/api/v1/paypal/webhooks", params: payload, headers: { "CONTENT_TYPE" => "application/json" }.merge(headers)
  end

  test "without a webhook id the endpoint answers 503 and stores nothing" do
    ENV.delete("PAYPAL_WEBHOOK_ID")
    post_event({ id: "WH-9", event_type: "PAYMENT.CAPTURE.COMPLETED" }.to_json)

    assert_response :service_unavailable
    assert_equal 0, WebhookEvent.count
  end

  test "a body that is not a PayPal event is a 400 and needs no sign-in" do
    original = ENV["PAYPAL_WEBHOOK_ID"]
    original_id = ENV["PAYPAL_CLIENT_ID"]
    original_secret = ENV["PAYPAL_CLIENT_SECRET"]
    ENV["PAYPAL_WEBHOOK_ID"] = "W"
    ENV["PAYPAL_CLIENT_ID"] = "id"
    ENV["PAYPAL_CLIENT_SECRET"] = "secret"
    post_event("this is not json")

    assert_response :bad_request
    assert_equal "error", body["status"]
  ensure
    { "PAYPAL_WEBHOOK_ID" => original, "PAYPAL_CLIENT_ID" => original_id, "PAYPAL_CLIENT_SECRET" => original_secret }.each do |key, value|
      value ? ENV[key] = value : ENV.delete(key)
    end
  end

  test "an oversized body is refused" do
    post_event({ id: "x" * 70_000 }.to_json)
    assert_response :content_too_large
  end

  test "the webhook path is not part of the general per-address throttle" do
    assert_equal "/api/v1/paypal/webhooks", Rack::Attack::WEBHOOK_PATH
  end
end
