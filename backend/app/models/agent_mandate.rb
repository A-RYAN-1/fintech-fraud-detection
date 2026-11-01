require "digest"
require "securerandom"

# A written permission a customer gives a shopping agent: one merchant, a cap per payment, a cap in total, an expiry,
# revocable at any time. The agent presents a secret token; only its SHA-256 digest is stored, and the token is
# shown once when the mandate is made. A mandate is checked before the risk score: it limits what the agent may
# ask for, the rules, model and analyst still judge every payment inside it.
class AgentMandate < ApplicationRecord
  TOKEN_PREFIX = "smt_".freeze
  MAX_LIFETIME = 30.days

  # Why a payment is refused. The code is stable, the sentence is for people.
  REFUSALS = {
    "mandate_revoked" => "This mandate was revoked",
    "mandate_expired" => "This mandate has expired",
    "merchant_not_allowed" => "This mandate does not cover that merchant",
    "over_per_payment_cap" => "The amount is above the per-payment cap of this mandate",
    "over_total_cap" => "The amount would take the mandate past its total cap"
  }.freeze

  class Refused < StandardError
    attr_reader :code

    def initialize(code)
      @code = code
      super(REFUSALS.fetch(code))
    end
  end

  belongs_to :user
  belongs_to :revoked_by, class_name: "User", optional: true
  has_many :transactions, dependent: :nullify

  validates :label, presence: true, length: { maximum: 80 }
  validates :merchant, presence: true, length: { maximum: 120 }
  validates :per_payment_cap, :total_cap, numericality: { greater_than: 0, less_than_or_equal_to: 10_000 }
  validates :expires_at, presence: true
  validate :caps_are_consistent
  validate :lifetime_is_bounded, on: :create

  # Returns [mandate, token]. The token cannot be read again.
  def self.issue!(**attrs)
    token = "#{TOKEN_PREFIX}#{SecureRandom.urlsafe_base64(32)}"
    mandate = create!(**attrs, token_digest: digest(token), token_hint: token.last(4))
    [ mandate, token ]
  end

  def self.digest(token)
    Digest::SHA256.hexdigest(token.to_s)
  end

  def self.find_by_token(token)
    return nil unless token.to_s.start_with?(TOKEN_PREFIX)

    find_by(token_digest: digest(token))
  end

  def revoked? = revoked_at.present?
  def expired? = expires_at <= Time.current
  def remaining = total_cap - spent_amount

  def status
    return "revoked" if revoked?
    return "expired" if expired?
    return "exhausted" if remaining <= 0

    "active"
  end

  # nil when the payment is inside the mandate, otherwise the refusal code. Reads the row as it is now.
  def refusal_for(amount:, merchant:)
    return "mandate_revoked" if revoked?
    return "mandate_expired" if expired?
    return "merchant_not_allowed" unless merchant.to_s.strip.casecmp?(self.merchant)
    return "over_per_payment_cap" if amount > per_payment_cap
    return "over_total_cap" if amount > remaining

    nil
  end

  # Checks and reserves the amount in one locked step, so two parallel payments cannot both fit the last of the cap.
  def reserve!(amount:, merchant:)
    with_lock do
      code = refusal_for(amount: amount, merchant: merchant)
      raise Refused, code if code

      update!(spent_amount: spent_amount + amount, last_used_at: Time.current)
    end
  end

  # A payment the rules voided never took money, so its share of the cap is given back.
  def release!(amount)
    with_lock { update!(spent_amount: [ spent_amount - amount, 0 ].max) }
  end

  def revoke!(by:)
    return self if revoked?

    update!(revoked_at: Time.current, revoked_by: by)
  end

  private

  def caps_are_consistent
    errors.add(:per_payment_cap, "cannot be above the total cap") if per_payment_cap && total_cap && per_payment_cap > total_cap
  end

  def lifetime_is_bounded
    return unless expires_at

    errors.add(:expires_at, "must be in the future") if expires_at <= Time.current
    errors.add(:expires_at, "can be at most #{MAX_LIFETIME.in_days.to_i} days away") if expires_at > MAX_LIFETIME.from_now + 1.minute
  end
end
