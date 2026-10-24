# Risk-gated PayPal payment: the buyer approves, PayPal authorizes (funds held, not taken), Sentrix scores the
# transaction, and only then is the money captured, held for review, or released (voided).
class PaypalCheckout
  CURRENCY = "USD".freeze

  Result = Struct.new(:transaction, :decision, keyword_init: true)

  def initialize(user:, client: PaypalClient.new)
    @user = user
    @client = client
  end

  # Creates the pending transaction and the PayPal order; the browser then asks the buyer to approve it.
  def create_order(amount:, device_id:, ip_address: nil)
    transaction = @user.transactions.new(amount: amount, payment_method: "wallet", device_id: device_id, ip_address: ip_address)
    transaction.save!
    order = @client.create_order(amount: transaction.amount, currency: CURRENCY, reference: transaction.id)
    transaction.update!(paypal_order_id: order.fetch("id"), paypal_status: "CREATED")
    transaction
  end

  # Idempotent: a transaction that already has an authorization is returned as it is.
  def settle(order_id)
    transaction = @user.transactions.find_by!(paypal_order_id: order_id)
    return Result.new(transaction: transaction, decision: decision_for(transaction)) if transaction.paypal_authorization_id.present?

    authorization = @client.authorize_order(order_id)
    transaction.update!(paypal_authorization_id: authorization.fetch("id"), paypal_status: "AUTHORIZED")

    TransactionRiskEvaluator.new(transaction).evaluate
    transaction.reload
    apply_decision(transaction)
    Result.new(transaction: transaction, decision: decision_for(transaction))
  end

  private

  def apply_decision(transaction)
    case transaction.status
    when "success"
      capture = @client.capture(transaction.paypal_authorization_id)
      transaction.update!(paypal_capture_id: capture.fetch("id"), paypal_status: "CAPTURED")
      audit(transaction, "PAYPAL_CAPTURED", "Approved by the risk score; payment captured")
    when "flagged"
      transaction.update!(paypal_status: "HELD")
      audit(transaction, "PAYPAL_HELD", "Flagged by the risk score; authorization kept, capture waits for review")
    when "blocked"
      @client.void(transaction.paypal_authorization_id)
      transaction.update!(paypal_status: "VOIDED")
      audit(transaction, "PAYPAL_VOIDED", "Blocked by the risk score; authorization voided, nothing was charged")
    end
  end

  def decision_for(transaction)
    { "CAPTURED" => "captured", "HELD" => "held", "VOIDED" => "voided" }.fetch(transaction.paypal_status, "pending")
  end

  def audit(transaction, event_type, description)
    AuditLog.create!(event_type: event_type, entity_type: "Transaction", entity_id: transaction.id, description: description)
  end
end
