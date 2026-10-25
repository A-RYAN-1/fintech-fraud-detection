# The agent's tool layer: capture, hold, void and refund one PayPal payment. Each action
#   - is idempotent: asking for the state the payment is already in changes nothing and calls PayPal zero times;
#   - refuses a payment in a state it cannot move from (InvalidState) instead of guessing;
#   - sends a PayPal-Request-Id derived from the transaction, so a retried call cannot move money twice;
#   - writes an AuditLog entry with the actor, the reason and the AI explanation.
# `auto: true` is the agent acting alone: the limits are checked again under a lock, so two parallel payments cannot
# both squeeze under the daily cap. A human (auto: false) is not bound by the limits and is named in the log.
class PaypalActions
  class InvalidState < StandardError; end
  class LimitExceeded < StandardError; end

  # Postgres advisory lock key that serializes automatic captures.
  CAPTURE_LOCK_KEY = 5_172_025

  def initialize(client:)
    @client = client
  end

  def capture(transaction, actor:, reason:, auto: false)
    transaction.with_lock do
      next transaction if transaction.paypal_status == "CAPTURED"

      require_state!(transaction, "capture", %w[AUTHORIZED HELD])
      Transaction.connection.execute("SELECT pg_advisory_xact_lock(#{CAPTURE_LOCK_KEY})") if auto
      if auto && (breach = AutoCaptureLimits.breach(transaction.amount))
        raise LimitExceeded, breach
      end

      response = @client.capture(transaction.paypal_authorization_id, request_id: "capture-#{transaction.id}")
      transaction.update!(paypal_capture_id: response.fetch("id"), paypal_status: "CAPTURED", paypal_captured_at: Time.current,
                          paypal_capture_mode: auto ? "auto" : "human", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_CAPTURED", actor, reason)
      transaction
    end
  end

  def hold(transaction, actor:, reason:)
    transaction.with_lock do
      next transaction if transaction.paypal_status == "HELD"

      require_state!(transaction, "hold", %w[AUTHORIZED])
      transaction.update!(paypal_status: "HELD", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_HELD", actor, reason)
      transaction
    end
  end

  def void(transaction, actor:, reason:)
    transaction.with_lock do
      next transaction if transaction.paypal_status == "VOIDED"

      require_state!(transaction, "void", %w[AUTHORIZED HELD])
      @client.void(transaction.paypal_authorization_id, request_id: "void-#{transaction.id}")
      transaction.update!(paypal_status: "VOIDED", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_VOIDED", actor, reason)
      transaction
    end
  end

  def refund(transaction, actor:, reason:)
    transaction.with_lock do
      next transaction if transaction.paypal_status == "REFUNDED"

      require_state!(transaction, "refund", %w[CAPTURED])
      response = @client.refund(transaction.paypal_capture_id, request_id: "refund-#{transaction.id}")
      transaction.update!(paypal_refund_id: response.fetch("id"), paypal_status: "REFUNDED", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_REFUNDED", actor, reason)
      transaction
    end
  end

  private

  def require_state!(transaction, action, allowed)
    return if allowed.include?(transaction.paypal_status)

    raise InvalidState, "Cannot #{action} a payment that is #{transaction.paypal_status.to_s.downcase.presence || 'not authorized'}"
  end

  def audit(transaction, event_type, actor, reason)
    ai = transaction.fraud_evaluation&.ai_verdict
    text = "#{actor}: #{reason}"
    text += " | AI analyst (#{ai['action']}, confidence #{ai['confidence']}): #{ai['explanation']}" if ai
    AuditLog.create!(event_type: event_type, entity_type: "Transaction", entity_id: transaction.id, description: text)
  end
end
