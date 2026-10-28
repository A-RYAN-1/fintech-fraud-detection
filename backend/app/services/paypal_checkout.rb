# Risk-gated PayPal payment: the buyer approves, PayPal authorizes (funds held, not taken), Sentrix scores the
# transaction, and only then is the money captured, held for review, or released (voided).
class PaypalCheckout
  CURRENCY = "USD".freeze
  ACTOR = "Agent".freeze

  Result = Struct.new(:transaction, :decision, keyword_init: true)

  def initialize(user:, client: PaypalClient.new)
    @user = user
    @client = client
  end

  # Creates the pending transaction and the PayPal order; the browser then asks the buyer to approve it.
  def create_order(amount:, device_id:, ip_address: nil, request_id: SecureRandom.uuid)
    transaction = @user.transactions.new(amount: amount, payment_method: "wallet", device_id: device_id, ip_address: ip_address)
    transaction.save!
    order = @client.create_order(amount: transaction.amount, currency: CURRENCY, reference: transaction.id, request_id: request_id)
    transaction.update!(paypal_order_id: order.fetch("id"), paypal_status: "CREATED")
    transaction
  end

  # Idempotent: a transaction that already has an authorization is returned as it is.
  def settle(order_id)
    transaction = @user.transactions.find_by!(paypal_order_id: order_id)
    return Result.new(transaction: transaction, decision: decision_for(transaction)) if transaction.paypal_authorization_id.present?

    authorization = @client.authorize_order(order_id, request_id: "authorize-#{order_id}")
    transaction.update!(paypal_authorization_id: authorization.fetch("id"), paypal_status: "AUTHORIZED")

    TransactionRiskEvaluator.new(transaction).evaluate
    transaction.reload
    apply_decision(transaction)
    Result.new(transaction: transaction, decision: decision_for(transaction))
  end

  private

  # Rules and model set the transaction status; AgentActionPolicy turns it, the AI verdict and the limits into one action.
  def apply_decision(transaction)
    ai = transaction.fraud_evaluation&.ai_verdict
    limit_breach = transaction.success? ? AutoCaptureLimits.breach(transaction.amount) : nil
    decision = AgentActionPolicy.decide(rules_status: transaction.status, ai: ai, limit_breach: limit_breach)

    case decision.action
    when :capture then actions.capture(transaction, actor: ACTOR, reason: decision.reason, auto: true)
    when :void then actions.void(transaction, actor: ACTOR, reason: decision.reason)
    else actions.hold(transaction, actor: ACTOR, reason: decision.reason)
    end
  rescue PaypalActions::LimitExceeded => e
    # Another payment took the last of the daily cap between the check and the lock.
    actions.hold(transaction, actor: ACTOR, reason: e.message)
  end

  def actions
    @actions ||= PaypalActions.new(client: @client)
  end

  def decision_for(transaction)
    { "CAPTURED" => "captured", "HELD" => "held", "VOIDED" => "voided", "REFUNDED" => "refunded" }.fetch(transaction.paypal_status, "pending")
  end
end
