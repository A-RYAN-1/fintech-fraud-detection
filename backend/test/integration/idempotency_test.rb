require "test_helper"

class IdempotencyTest < ActionDispatch::IntegrationTest
  class CountingClient
    attr_reader :calls

    def initialize = @calls = []

    def create_order(amount:, currency:, reference:, request_id: nil)
      @calls << [ :create_order, request_id ]
      { "id" => "ORDER-#{reference.to_s.first(8)}" }
    end

    def authorize_order(_id, **) = { "id" => "AUTH-1" }
    def capture(_id, **) = { "id" => "CAP-1" }
    def void(_id, **) = {}
    def refund(_id, **) = { "id" => "REF-1" }
  end

  setup do
    RiskRuleConfig.reset_cache!
    @client = CountingClient.new
    post api_v1_auth_login_url, params: { email: users(:one).email, password: "password123" }
  end

  def body = JSON.parse(response.body)

  def with_paypal(&block)
    client = @client
    replace_class_method(PaypalClient, :configured?, -> { true }) do
      replace_class_method(PaypalClient, :new, ->(*) { client }, &block)
    end
  end

  def create_order(key: "key-1", amount: "19.99")
    post "/api/v1/paypal/orders", params: { amount: amount, device_id: "browser-1" }, headers: { "Idempotency-Key" => key }
  end

  test "a retried order create returns the stored response and creates nothing twice" do
    with_paypal do
      assert_difference("Transaction.count", 1) { create_order }
      assert_response :created
      first = response.body
      assert_nil response.headers["Idempotency-Replayed"]

      assert_no_difference([ "Transaction.count", "IdempotencyKey.count" ]) { create_order }
      assert_response :created
      assert_equal first, response.body
      assert_equal "true", response.headers["Idempotency-Replayed"]
    end
    assert_equal 1, @client.calls.size
  end

  test "the key is passed to PayPal as the request id" do
    with_paypal { create_order(key: "abc-123") }
    expected = Digest::SHA256.hexdigest("order:#{users(:one).id}:abc-123")
    assert_equal [ [ :create_order, expected ] ], @client.calls
  end

  test "the same key with a different body is a 422 and runs nothing" do
    with_paypal do
      create_order(amount: "10")
      assert_no_difference("Transaction.count") { create_order(amount: "20") }
    end
    assert_response :unprocessable_entity
    assert_match(/different request/, body["message"])
    assert_equal 1, @client.calls.size
  end

  test "the same key on a different endpoint is a 422" do
    with_paypal do
      create_order
      post "/api/v1/payments/simulate", params: { amount: "19.99", device_id: "browser-1" }, headers: { "Idempotency-Key" => "key-1" }
    end
    assert_response :unprocessable_entity
  end

  test "a key is private to its user" do
    with_paypal { create_order }
    delete api_v1_auth_logout_url
    post api_v1_auth_login_url, params: { email: users(:reviewer).email, password: "password123" }
    with_paypal { assert_difference("Transaction.count", 1) { create_order } }
    assert_response :created
    assert_nil response.headers["Idempotency-Replayed"]
  end

  test "without the header every request runs" do
    with_paypal do
      assert_difference("Transaction.count", 2) do
        2.times { post "/api/v1/paypal/orders", params: { amount: "5", device_id: "d" } }
      end
    end
  end

  test "a malformed key is rejected" do
    with_paypal { create_order(key: "bad key!") }
    assert_response :unprocessable_entity
    assert_equal 0, @client.calls.size
  end

  test "a request still in progress with the same key is a 409" do
    fingerprint = nil
    with_paypal { create_order(key: "slow") }
    record = IdempotencyKey.find_by!(key: "slow")
    fingerprint = record.request_fingerprint
    record.update!(response_status: nil, response_body: nil)
    with_paypal { create_order(key: "slow") }
    assert_response :conflict
    assert_equal "1", response.headers["Retry-After"]
    assert_equal fingerprint, record.reload.request_fingerprint
  end

  test "a claim whose request died is freed after the stale window and runs again" do
    with_paypal { create_order(key: "dead") }
    IdempotencyKey.find_by!(key: "dead").update!(response_status: nil, response_body: nil, created_at: 10.minutes.ago)
    with_paypal { assert_difference("Transaction.count", 1) { create_order(key: "dead") } }
    assert_response :created
  end

  test "a server error is not stored, so the same key can be retried" do
    failing = Object.new
    def failing.create_order(**) = raise(PaypalClient::Error.new("boom", status: 500))
    replace_class_method(PaypalClient, :configured?, -> { true }) do
      replace_class_method(PaypalClient, :new, ->(*) { failing }) { create_order(key: "retry") }
    end
    assert_response :bad_gateway
    assert_nil IdempotencyKey.find_by(key: "retry")

    with_paypal { create_order(key: "retry") }
    assert_response :created
  end

  test "expired keys are purged" do
    IdempotencyKey.create!(user: users(:one), key: "old", request_method: "POST", request_path: "/x", request_fingerprint: "f",
                           response_status: 201, response_body: "{}", created_at: 25.hours.ago)
    with_paypal { create_order(key: "new") }
    assert_nil IdempotencyKey.find_by(key: "old")
  end

  test "a double click on simulate settles one payment" do
    replace_class_method(PaypalClient, :configured?, -> { false }) do
      assert_difference("Transaction.count", 1) do
        2.times { post "/api/v1/payments/simulate", params: { amount: "40", device_id: "d" }, headers: { "Idempotency-Key" => "dbl" } }
      end
    end
    assert_response :created
    assert_equal "true", response.headers["Idempotency-Replayed"]
  end

  test "an approve retried with the same key replays and captures once" do
    admin = users(:admin)
    delete api_v1_auth_logout_url
    post api_v1_auth_login_url, params: { email: admin.email, password: "password123" }
    held = admin.transactions.create!(amount: 300, payment_method: "wallet", device_id: "d", status: "FLAGGED", risk_score: 30,
                                      paypal_status: "HELD", paypal_authorization_id: "AUTH-1")
    with_paypal do
      2.times { post "/api/v1/admin/review_queue/#{held.id}/approve", params: { note: "ok" }, headers: { "Idempotency-Key" => "appr-1" } }
    end
    assert_response :success
    assert_equal "true", response.headers["Idempotency-Replayed"]
    assert_equal "CAPTURED", held.reload.paypal_status
    assert_equal 1, AuditLog.where(event_type: "PAYPAL_CAPTURED", entity_id: held.id.to_s).count
  end
end
