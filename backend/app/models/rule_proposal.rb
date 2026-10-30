# One drafted change to a risk rule, with the backtest that was run before anyone saw it.
class RuleProposal < ApplicationRecord
  TRIGGERS = %w[false_alarm miss].freeze

  belongs_to :source_payment, class_name: "Transaction", optional: true
  belongs_to :decided_by, class_name: "User", optional: true

  enum :status, { pending: "pending", accepted: "accepted", rejected: "rejected", superseded: "superseded" }, default: :pending

  validates :key, inclusion: { in: RiskRuleConfig::DEFINITIONS.keys }
  validates :trigger_kind, inclusion: { in: TRIGGERS }
  validates :rationale, presence: true
  validates :current_value, :proposed_value, numericality: true
end
