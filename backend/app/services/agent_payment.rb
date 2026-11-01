# A payment an agent asks for under a mandate. Order of checks:
#   1. the mandate (revoked, expired, merchant, per-payment cap, total cap) - a refusal is audited and nothing is created;
#   2. the same pipeline as every other payment: rules, model, AI analyst, admin limits, then capture, hold or void.
# The cap is reserved before the pipeline runs and given back when the rules void the payment, so a voided payment
# never uses up a mandate. The PayPal calls are simulated: an agent cannot click through the PayPal approval popup,
# so no money moves; the decision path is the real one.
class AgentPayment
  Result = Struct.new(:transaction, :decision, :mandate, keyword_init: true)

  def initialize(mandate:, client: SimulatedPaypalClient.new)
    @mandate = mandate
    @client = client
  end

  # Raises AgentMandate::Refused (already audited) when the payment is outside the mandate.
  def call(amount:, merchant:, device_id:, ip_address: nil, purpose: nil)
    reserve(amount, merchant)

    checkout = PaypalCheckout.new(user: @mandate.user, client: @client)
    transaction = checkout.create_order(amount: amount, device_id: device_id, ip_address: ip_address, mandate: @mandate)
    result = checkout.settle(transaction.paypal_order_id)
    @mandate.release!(amount) if result.decision == "voided"
    audit_payment(result.transaction, result.decision, purpose)
    notify_owner(result.transaction, result.decision)
    Result.new(transaction: result.transaction, decision: result.decision, mandate: @mandate.reload)
  rescue AgentMandate::Refused
    raise
  rescue StandardError
    # Anything that failed after the reservation gives the cap back; the caller sees the error.
    @mandate.release!(amount) if @reserved
    raise
  end

  private

  def reserve(amount, merchant)
    @mandate.reserve!(amount: amount, merchant: merchant)
    @reserved = true
  rescue AgentMandate::Refused => e
    AuditLog.record!(event_type: "MANDATE_REFUSED", entity_type: "AgentMandate", entity_id: @mandate.id, actor: actor_name,
                     description: "#{@mandate.label} was refused a payment of #{format('%.2f', amount)} to #{merchant.to_s.first(60)}: #{e.message}",
                     after: { code: e.code, amount: amount.to_s, merchant: merchant.to_s.first(120) }, reason: e.code)
    raise
  end

  def audit_payment(transaction, decision, purpose)
    AuditLog.record!(event_type: "MANDATE_PAYMENT", entity_type: "AgentMandate", entity_id: @mandate.id, actor: actor_name,
                     description: "#{@mandate.label} paid #{format('%.2f', transaction.amount)} to #{@mandate.merchant} under its mandate: #{decision}",
                     after: { transaction_id: transaction.id, decision: decision, spent: @mandate.reload.spent_amount.to_s, total_cap: @mandate.total_cap.to_s },
                     reason: purpose)
  end

  # The owner hears what their agent did, in the app, in one line: what, to whom, the outcome and what is left.
  def notify_owner(transaction, decision)
    outcome = { "captured" => "paid", "held" => "held for review", "voided" => "not completed" }.fetch(decision, decision)
    @mandate.user.notifications.create!(
      notification_type: "transaction", priority: decision == "captured" ? "low" : "medium",
      title: "Your agent #{@mandate.label.first(60)} made a payment",
      message: "#{ActiveSupport::NumberHelper.number_to_currency(transaction.amount, unit: '$')} to #{@mandate.merchant.first(80)}: #{outcome}. "                "#{ActiveSupport::NumberHelper.number_to_currency(@mandate.reload.remaining, unit: '$')} left on its mandate.",
      data: { transaction_id: transaction.id, agent_mandate_id: @mandate.id, decision: decision }
    )
  rescue StandardError => e
    # A failed notice must never undo or hide a payment that was already decided.
    Rails.logger.warn("Agent payment notice skipped: #{e.class}: #{e.message}")
  end

  def actor_name
    "Agent #{@mandate.label.first(60)}"
  end
end
