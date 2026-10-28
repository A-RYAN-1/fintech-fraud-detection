# A client-supplied Idempotency-Key and what the server answered the first time. See Idempotent.
class IdempotencyKey < ApplicationRecord
  TTL = 24.hours
  # A request that claimed a key but never finished (the process died) frees the key after this long.
  STALE_AFTER = 2.minutes

  belongs_to :user

  validates :key, presence: true, length: { maximum: 255 }, format: { with: /\A[\w\-.:]+\z/ }

  def self.purge_expired
    where(created_at: ...TTL.ago).delete_all
  end

  def completed? = response_status.present?

  def stale? = !completed? && created_at < STALE_AFTER.ago
end
