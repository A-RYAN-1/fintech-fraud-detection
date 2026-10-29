class User < ApplicationRecord
  has_secure_password

  # Associations
  has_many :transactions, dependent: :destroy
  has_many :devices, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :idempotency_keys, dependent: :delete_all
  has_one :user_transaction_stat, dependent: :destroy

  # Enums
  enum :role, { customer: 0, admin: 1, reviewer: 2, analyst: 3 }, default: :customer
  enum :status, { active: 0, suspended: 1, pending: 2 }, default: :active

  # Reviewers decide up to this amount unless the admin set a limit of their own; admins have none; analysts decide nothing.
  DEFAULT_REVIEWER_LIMIT = BigDecimal("1000")
  STAFF_ROLES = %w[admin reviewer analyst].freeze
  # The sandbox logins on the sign-in page. Everyone who tries Sentrix shares them, so the app never edits them;
  # `rake demo:judges` creates and resets them.
  SANDBOX_ADMIN_EMAIL = "judge.admin@sentrix.demo"
  DEMO_EMAILS = [ "john@example.com", "judge.reviewer@sentrix.demo", SANDBOX_ADMIN_EMAIL ].freeze

  def staff?
    STAFF_ROLES.include?(role)
  end

  def demo_account?
    DEMO_EMAILS.include?(email)
  end

  # The shared admin login: it settles requests like any admin but cannot change admins or demo accounts.
  def sandbox_admin?
    admin? && email == SANDBOX_ADMIN_EMAIL
  end

  def can_decide?
    admin? || reviewer?
  end

  # nil means no limit (admin); a number is the largest payment this person may approve, void or refund alone.
  def effective_decision_limit
    return nil if admin?
    return BigDecimal("0") unless reviewer?

    decision_limit || DEFAULT_REVIEWER_LIMIT
  end

  def within_limit?(amount)
    limit = effective_decision_limit
    limit.nil? || amount <= limit
  end

  # Validations
  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, presence: true,
                       length: { minimum: 8 },
                       if: -> { new_record? || password.present? }
  validates :first_name, :last_name, presence: true
  validates :decision_limit, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Callbacks
  before_save :normalize_email

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end
end
