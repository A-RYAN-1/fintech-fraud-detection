class User < ApplicationRecord
  has_secure_password

  # Associations
  has_many :transactions, dependent: :destroy
  has_many :devices, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :idempotency_keys, dependent: :delete_all
  has_one :user_transaction_stat, dependent: :destroy

  # Enums
  enum :role, { customer: 0, admin: 1, manager: 2 }, default: :customer
  enum :status, { active: 0, suspended: 1, pending: 2 }, default: :active

  # Validations
  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, presence: true,
                       length: { minimum: 8 },
                       if: -> { new_record? || password.present? }
  validates :first_name, :last_name, presence: true

  # Callbacks
  before_save :normalize_email

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end
end
