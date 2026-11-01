# The customer's one note on a held payment, kept as an audit row so the reviewer sees it with the other notes.
# `customer_message` is the plain sentence the customer sees about a payment: it says what state the payment is in and
# what it means for their money, and never names a rule, a score or a signal.
module Appeal
  EVENT = "CUSTOMER_APPEAL".freeze

  MESSAGES = {
    "HELD" => "A person is reviewing this payment. Nothing is charged until they decide.",
    "VOIDED" => "This payment was not completed and you were not charged."
  }.freeze

  def self.record!(transaction, user:, text:)
    AuditLog.record!(event_type: EVENT, entity_type: "Transaction", entity_id: transaction.id, actor: user,
                     description: "#{user.email} sent a note on a held payment", reason: text)
  end

  def self.exists_for?(transaction)
    AuditLog.exists?(event_type: EVENT, entity_type: "Transaction", entity_id: transaction.id.to_s)
  end

  # { transaction id => AuditLog } for a page of payments, in one query.
  def self.for_all(transaction_ids)
    return {} if transaction_ids.empty?

    AuditLog.where(event_type: EVENT, entity_type: "Transaction", entity_id: transaction_ids.map(&:to_s)).index_by(&:entity_id)
  end

  def self.customer_message(transaction)
    MESSAGES[transaction.paypal_status]
  end

  def self.can_appeal?(transaction, appeals)
    transaction.paypal_status == "HELD" && !appeals.key?(transaction.id.to_s)
  end
end
