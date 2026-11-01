# One row per PayPal webhook event id. The unique index on event_id is what makes a replayed delivery a no-op.
# outcome: received (stored, not yet handled), applied (changed a payment), recorded (valid, nothing to change),
# failed (the handler raised; the next delivery of the same event handles it again).
class WebhookEvent < ApplicationRecord
  OUTCOMES = %w[received applied recorded failed].freeze

  validates :event_id, :event_type, presence: true
  validates :outcome, inclusion: { in: OUTCOMES }

  def settled? = %w[applied recorded].include?(outcome)
end
