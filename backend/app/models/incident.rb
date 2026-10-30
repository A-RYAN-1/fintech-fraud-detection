# One kind of failure, counted. Rows are written by IncidentLog (a PayPal call failed) and IncidentScan (failed jobs,
# the AI analyst), never by hand. A person approves the drafted report (reported) or dismisses it; a new occurrence
# after that reopens it and counts as a recurrence.
class Incident < ApplicationRecord
  KINDS = %w[paypal_error job_failed analyst].freeze

  belongs_to :decided_by, class_name: "User", optional: true

  enum :status, { open: "open", reported: "reported", dismissed: "dismissed" }, default: :open

  validates :fingerprint, presence: true, uniqueness: true
  validates :kind, inclusion: { in: KINDS }
  validates :title, presence: true
  validates :occurrences, numericality: { only_integer: true, greater_than: 0 }
  validates :issue_url, format: { with: %r{\Ahttps://[^\s]+\z}, message: "must be an https link" }, allow_blank: true
end
