# Receives one PayPal webhook delivery: verify the signature with PayPal, store the event id once, then apply the one
# change that is safe to take from PayPal alone.
#   - Signature: PayPal's verify-webhook-signature call with our webhook id (PAYPAL_WEBHOOK_ID). No id, no processing.
#   - Dedupe: the event id has a unique index, so a replay is acknowledged and ignored. A delivery whose first handling
#     raised (outcome failed) is handled again, so a retry from PayPal repairs it.
#   - Applied: PAYMENT.AUTHORIZATION.VOIDED moves a payment that is still HELD or AUTHORIZED to VOIDED (an authorization
#     voided or expired on PayPal's side). Every other event type is recorded and nothing else changes: refunds are not
#     replayed from events because our own refunds also raise them and would be counted twice.
class PaypalWebhook
  Result = Struct.new(:code, :outcome)

  OPEN_STATES = %w[HELD AUTHORIZED].freeze

  def initialize(client: nil, webhook_id: ENV["PAYPAL_WEBHOOK_ID"])
    @client = client
    @webhook_id = webhook_id
  end

  # headers: the five PAYPAL-* transmission headers as a hash. raw_body: the request body as received.
  def receive(headers:, raw_body:)
    return Result.new(:not_configured) if @webhook_id.blank? || !(@client || PaypalClient.configured?)

    event = parse(raw_body)
    return Result.new(:bad_request) unless event

    return Result.new(:unauthorized) unless verified?(headers, event)

    record = store(event)
    return Result.new(:ok, "duplicate") if record.settled?

    handle(record, event)
  rescue PaypalClient::Error => e
    Rails.logger.warn("PayPal webhook verification unavailable: #{e.message}")
    Result.new(:unavailable)
  end

  private

  def client
    @client ||= PaypalClient.new
  end

  def parse(raw_body)
    event = JSON.parse(raw_body.to_s)
    event.is_a?(Hash) && event["id"].present? && event["event_type"].present? ? event : nil
  rescue JSON::ParserError
    nil
  end

  def verified?(headers, event)
    client.verify_webhook(headers: headers, event: event, webhook_id: @webhook_id)
  end

  def store(event)
    WebhookEvent.create_with(event_type: event["event_type"].to_s.first(100), resource_id: event.dig("resource", "id").to_s.first(100).presence)
                .find_or_create_by!(event_id: event["id"].to_s.first(100))
  rescue ActiveRecord::RecordNotUnique
    WebhookEvent.find_by!(event_id: event["id"].to_s.first(100))
  end

  def handle(record, event)
    outcome = event["event_type"] == "PAYMENT.AUTHORIZATION.VOIDED" ? apply_void(event) : "recorded"
    record.update!(outcome: outcome, error: nil, processed_at: Time.current)
    Result.new(:ok, outcome)
  rescue StandardError => e
    record.update(outcome: "failed", error: "#{e.class}: #{e.message}".first(255))
    Rails.logger.error("PayPal webhook #{record.event_id} failed: #{e.class}")
    Result.new(:error, "failed")
  end

  def apply_void(event)
    authorization_id = event.dig("resource", "id").to_s
    return "recorded" if authorization_id.blank?

    applied = false
    Transaction.where(paypal_authorization_id: authorization_id).limit(1).each do |transaction|
      transaction.with_lock do
        next unless OPEN_STATES.include?(transaction.paypal_status)

        before = { paypal_status: transaction.paypal_status }
        transaction.update!(paypal_status: "VOIDED", paypal_action_reason: "Authorization voided on PayPal's side")
        AuditLog.record!(event_type: "PAYPAL_VOIDED", entity_type: "Transaction", entity_id: transaction.id,
                         description: "PayPal reported the authorization voided or expired (webhook #{event['id']})",
                         actor: "PayPal", before: before, after: { paypal_status: "VOIDED" }, reason: "Authorization voided on PayPal's side")
        applied = true
      end
    end
    applied ? "applied" : "recorded"
  end
end
