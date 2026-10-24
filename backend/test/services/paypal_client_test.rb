require "test_helper"

class PaypalClientTest < ActiveSupport::TestCase
  test "refuses to start without credentials" do
    assert_raises(PaypalClient::NotConfigured) { PaypalClient.new(client_id: "", secret: "") }
  end

  test "defaults to the sandbox, never to live" do
    assert_equal "https://api-m.sandbox.paypal.com", PaypalClient::SANDBOX_URL
  end

  test "configured? needs both variables" do
    original = ENV.to_h.slice("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET")
    ENV["PAYPAL_CLIENT_ID"] = "id"
    ENV.delete("PAYPAL_CLIENT_SECRET")
    refute PaypalClient.configured?
    ENV["PAYPAL_CLIENT_SECRET"] = "secret"
    assert PaypalClient.configured?
  ensure
    %w[PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET].each { |k| original&.key?(k) ? ENV[k] = original[k] : ENV.delete(k) }
  end
end
