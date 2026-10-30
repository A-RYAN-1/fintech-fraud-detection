class Transaction < ApplicationRecord
  # PayPal honours an authorization for 29 days; the real expiry comes back in the authorize response.
  AUTHORIZATION_TTL = 29.days

  belongs_to :user

  after_commit { AnalyticsCache.bump }
  has_one :fraud_evaluation, dependent: :destroy, foreign_key: "transaction_id"

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :payment_method, presence: true
  validates :status, presence: true
  validates :device_id, presence: true, length: { maximum: 255 }
  validates :ip_address, length: { maximum: 45 }, allow_blank: true # 45 for IPv6

  enum :status, { pending: "PENDING", success: "SUCCESS", flagged: "FLAGGED", blocked: "BLOCKED" }, default: :pending
  enum :payment_method, { card: "card", upi: "upi", bank_transfer: "bank_transfer", wallet: "wallet" }, default: :card

  def simulated?
    SimulatedPaypalClient.simulated_id?(paypal_order_id)
  end

  def authorization_expired?
    paypal_authorization_expires_at.present? && paypal_authorization_expires_at <= Time.current
  end

  # What is still refundable: the captured amount (a capture is always the full amount) less refunds so far.
  def refundable_amount
    paypal_capture_id.present? ? amount - refunded_amount : 0
  end
end
