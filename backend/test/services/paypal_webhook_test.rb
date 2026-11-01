require "test_helper"

class PaypalWebhookTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :calls

    def initialize(verified: true, error: nil)
      @verified = verified
      @error = error
      @calls = 0
    end

    def verify_webhook(headers:, event:, webhook_id:)
      @calls += 1
      raise @error if @error

      @verified
    end
  end

  HEADERS = { "PAYPAL-TRANSMISSION-ID" => "t-1" }.freeze

  setup do
    @held = users(:one).transactions.create!(amount: 100, payment_method: "wallet", device_id: "d", status: "FLAGGED",
                                             paypal_status: "HELD", paypal_authorization_id: "AUTH-1")
  end

  def body(id: "WH-1", type: "PAYMENT.AUTHORIZATION.VOIDED", resource_id: "AUTH-1")
    { id: id, event_type: type, resource: { id: resource_id } }.to_json
  end

  def receive(raw, client: FakeClient.new, webhook_id: "WEBHOOK-ID")
    PaypalWebhook.new(client: client, webhook_id: webhook_id).receive(headers: HEADERS, raw_body: raw)
  end

  test "an authorization voided on PayPal's side voids a held payment and writes an audit row" do
    result = receive(body)

    assert_equal [ :ok, "applied" ], [ result.code, result.outcome ]
    assert_equal "VOIDED", @held.reload.paypal_status
    log = AuditLog.find_by!(event_type: "PAYPAL_VOIDED")
    assert_equal @held.id.to_s, log.entity_id
    assert_equal "system", log.actor_role
    assert_equal "applied", WebhookEvent.find_by!(event_id: "WH-1").outcome
  end

  test "a replayed event is acknowledged and changes nothing the second time" do
    receive(body)
    @held.update_columns(paypal_status: "HELD")
    client = FakeClient.new
    result = receive(body, client: client)

    assert_equal [ :ok, "duplicate" ], [ result.code, result.outcome ]
    assert_equal "HELD", @held.reload.paypal_status, "the replay did not run the handler again"
    assert_equal 1, WebhookEvent.where(event_id: "WH-1").count
    assert_equal 1, AuditLog.where(event_type: "PAYPAL_VOIDED").count
  end

  test "an event for a payment that is no longer open is recorded and not applied" do
    @held.update!(paypal_status: "CAPTURED")
    result = receive(body)

    assert_equal "recorded", result.outcome
    assert_equal "CAPTURED", @held.reload.paypal_status
    assert_equal 0, AuditLog.where(event_type: "PAYPAL_VOIDED").count
  end

  test "other event types and unknown authorizations are recorded only" do
    assert_equal "recorded", receive(body(id: "WH-2", type: "PAYMENT.CAPTURE.COMPLETED")).outcome
    assert_equal "recorded", receive(body(id: "WH-3", resource_id: "AUTH-UNKNOWN")).outcome
    assert_equal "HELD", @held.reload.paypal_status
  end

  test "an event PayPal does not vouch for is refused and not stored" do
    result = receive(body, client: FakeClient.new(verified: false))

    assert_equal :unauthorized, result.code
    assert_equal 0, WebhookEvent.count
    assert_equal "HELD", @held.reload.paypal_status
  end

  test "no webhook id means nothing is processed, and a bad body is refused before PayPal is asked" do
    assert_equal :not_configured, receive(body, webhook_id: "").code
    client = FakeClient.new
    assert_equal :bad_request, receive("not json", client: client).code
    assert_equal :bad_request, receive({ event_type: "X" }.to_json, client: client).code
    assert_equal 0, client.calls
  end

  test "when PayPal cannot be asked the answer is a retryable failure and nothing is stored" do
    result = receive(body, client: FakeClient.new(error: PaypalClient::Error.new("down")))

    assert_equal :unavailable, result.code
    assert_equal 0, WebhookEvent.count
  end

  test "an event whose first handling failed is handled again on the next delivery" do
    failing = Class.new(PaypalWebhook) do
      def apply_void(_event) = raise("boom")
    end
    first = failing.new(client: FakeClient.new, webhook_id: "W").receive(headers: HEADERS, raw_body: body)
    assert_equal :error, first.code
    assert_equal "failed", WebhookEvent.find_by!(event_id: "WH-1").outcome
    assert_equal "HELD", @held.reload.paypal_status

    second = receive(body)
    assert_equal "applied", second.outcome
    assert_equal "VOIDED", @held.reload.paypal_status
    assert_equal 1, WebhookEvent.where(event_id: "WH-1").count
  end
end
