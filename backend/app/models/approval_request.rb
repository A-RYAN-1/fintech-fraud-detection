# One person asked for a decision on a payment and an admin has not settled it yet (or has).
class ApprovalRequest < ApplicationRecord
  ACTIONS = %w[approve void refund].freeze

  belongs_to :payment, class_name: "Transaction"
  belongs_to :requested_by, class_name: "User"
  belongs_to :decided_by, class_name: "User", optional: true

  enum :status, { pending: "pending", approved: "approved", rejected: "rejected" }, default: :pending

  validates :action, inclusion: { in: ACTIONS }
  validates :amount, numericality: { greater_than: 0 }, allow_nil: true
end
