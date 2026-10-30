# The agent's tool layer: capture, hold, void and refund one PayPal payment. Each action
#   - is idempotent: asking for the state the payment is already in changes nothing and calls PayPal zero times;
#   - refuses a payment in a state it cannot move from (InvalidState) instead of guessing;
#   - sends a PayPal-Request-Id derived from the transaction, so a retried call cannot move money twice;
#   - writes an AuditLog entry with the actor, the reason and the AI explanation.
# `actor` is the User who acted, or a name such as "System" for the agent and jobs.
# `auto: true` is the agent acting alone: the limits are checked again under a lock, so two parallel payments cannot
# both squeeze under the daily cap. A human (auto: false) is not bound by the limits and is named in the log.
class PaypalActions
  class InvalidState < StandardError; end
  class LimitExceeded < StandardError; end
  # The refund amount is not positive or is more than is left to refund.
  class InvalidAmount < StandardError; end
  # PayPal could not pay the refund out of the merchant balance.
  class InsufficientFunds < StandardError; end

  # Postgres advisory lock key that serializes automatic captures.
  CAPTURE_LOCK_KEY = 5_172_025

  def initialize(client:)
    @client = client
  end

  def capture(transaction, actor:, reason:, auto: false)
    transaction.with_lock do
      before = snapshot(transaction)
      next transaction if transaction.paypal_status == "CAPTURED"

      require_state!(transaction, "capture", %w[AUTHORIZED HELD])
      raise InvalidState, "The authorization expired on #{transaction.paypal_authorization_expires_at.to_date}, so it can no longer be captured" if transaction.authorization_expired?
      Transaction.connection.execute("SELECT pg_advisory_xact_lock(#{CAPTURE_LOCK_KEY})") if auto
      if auto && (breach = AutoCaptureLimits.breach(transaction.amount))
        raise LimitExceeded, breach
      end

      response = @client.capture(transaction.paypal_authorization_id, request_id: "capture-#{transaction.id}")
      transaction.update!(paypal_capture_id: response.fetch("id"), paypal_status: "CAPTURED", paypal_captured_at: Time.current,
                          paypal_capture_mode: auto ? "auto" : "human", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_CAPTURED", actor, reason, before)
      label!(transaction, actor, "approve", "decision") if before[:paypal_status] == "HELD"
      transaction
    end
  end

  def hold(transaction, actor:, reason:)
    transaction.with_lock do
      before = snapshot(transaction)
      next transaction if transaction.paypal_status == "HELD"

      require_state!(transaction, "hold", %w[AUTHORIZED])
      transaction.update!(paypal_status: "HELD", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_HELD", actor, reason, before)
      transaction
    end
  end

  def void(transaction, actor:, reason:)
    transaction.with_lock do
      before = snapshot(transaction)
      next transaction if transaction.paypal_status == "VOIDED"

      require_state!(transaction, "void", %w[AUTHORIZED HELD])
      @client.void(transaction.paypal_authorization_id, request_id: "void-#{transaction.id}")
      transaction.update!(paypal_status: "VOIDED", paypal_action_reason: reason.to_s.truncate(255))
      audit(transaction, "PAYPAL_VOIDED", actor, reason, before)
      label!(transaction, actor, "block", "decision") if before[:paypal_status] == "HELD"
      transaction
    end
  end

  # Full refund of what is left by default; `amount:` refunds part of it. Refunds add up: the total never passes the
  # captured amount. Asking again for a payment that is already fully refunded changes nothing.
  def refund(transaction, actor:, reason:, amount: nil)
    transaction.with_lock do
      before = snapshot(transaction)
      next transaction if transaction.paypal_status == "REFUNDED" && amount.nil?

      require_state!(transaction, "refund", %w[CAPTURED PARTIALLY_REFUNDED])
      remaining = transaction.refundable_amount
      raise InvalidAmount, "Nothing is left to refund" unless remaining.positive?

      partial = amount.present? && BigDecimal(amount.to_s) < remaining
      refund_amount = amount.present? ? BigDecimal(amount.to_s) : remaining
      raise InvalidAmount, "Refund must be more than 0 and at most #{remaining.to_s('F')} (what is left)" unless refund_amount.positive? && refund_amount <= remaining

      response = call_refund(transaction, refund_amount, partial)
      total = transaction.refunded_amount + refund_amount
      transaction.update!(paypal_refund_id: response.fetch("id"), refunded_amount: total, paypal_action_reason: reason.to_s.truncate(255),
                          paypal_status: total >= transaction.amount ? "REFUNDED" : "PARTIALLY_REFUNDED")
      audit(transaction, total >= transaction.amount ? "PAYPAL_REFUNDED" : "PAYPAL_PARTIALLY_REFUNDED", actor,
            "#{reason} (refunded #{refund_amount.to_s('F')} of #{transaction.amount.to_s('F')}, #{total.to_s('F')} in total)", before)
      label!(transaction, actor, "block", "refund") if total >= transaction.amount
      transaction
    end
  end

  private

  # The first full refund keeps the plain `refund-<id>` request id; any other refund is keyed by what was refunded
  # before and how much now, so a retry of the same refund is the same PayPal request and a different one is new.
  def call_refund(transaction, refund_amount, partial)
    first_full = !partial && transaction.refunded_amount.zero?
    request_id = first_full ? "refund-#{transaction.id}" : "refund-#{transaction.id}-#{(transaction.refunded_amount * 100).to_i}-#{(refund_amount * 100).to_i}"
    options = partial ? { amount: refund_amount } : {}
    @client.refund(transaction.paypal_capture_id, request_id: request_id, **options)
  rescue PaypalClient::Error => e
    raise InsufficientFunds, "The merchant balance cannot cover this refund. Add funds to the PayPal account and try again." if e.insufficient_funds?

    raise
  end

  def require_state!(transaction, action, allowed)
    return if allowed.include?(transaction.paypal_status)

    raise InvalidState, "Cannot #{action} a payment that is #{transaction.paypal_status.to_s.downcase.presence || 'not authorized'}"
  end

  # A person's decision is the label the automatic signals are scored against (see FeedbackReport). The agent's own
  # actions are not labels. A later full refund turns an approval into a block.
  def label!(transaction, actor, value, source)
    return unless actor.is_a?(User)

    evaluation = transaction.fraud_evaluation
    return unless evaluation

    evaluation.update!(human_label: value, label_source: source, labeled_by: actor, labeled_at: Time.current)
    RuleProposalJob.perform_later(evaluation.id)
  end

  def snapshot(transaction)
    { paypal_status: transaction.paypal_status, refunded_amount: transaction.refunded_amount.to_s("F") }
  end

  def audit(transaction, event_type, actor, reason, before)
    ai = transaction.fraud_evaluation&.ai_verdict
    name = actor.is_a?(User) ? actor.email : actor
    text = "#{name}: #{reason}"
    text += " | AI analyst (#{ai['action']}, confidence #{ai['confidence']}): #{ai['explanation']}" if ai
    AuditLog.record!(event_type: event_type, entity_type: "Transaction", entity_id: transaction.id, description: text,
                     actor: actor, before: before, after: snapshot(transaction), reason: reason)
  end
end
