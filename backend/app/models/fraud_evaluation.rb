class FraudEvaluation < ApplicationRecord
  belongs_to :financial_transaction, class_name: "Transaction", foreign_key: "transaction_id"

  belongs_to :labeled_by, class_name: "User", optional: true

  after_commit { AnalyticsCache.bump }

  LABELS = %w[approve block].freeze
  validates :human_label, inclusion: { in: LABELS }, allow_nil: true
  validates :risk_score, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :is_accurate, inclusion: { in: [ true, false ] }, allow_nil: true
  validates :user_feedback, length: { maximum: 500 }, allow_blank: true
end
