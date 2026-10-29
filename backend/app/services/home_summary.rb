# The numbers on each role's Home: how payments moved through the checks, and the one thing to do next.
# A customer sees only their own payments, all time. Staff see every payment of the last 7 days as counts only,
# with no customer details.
class HomeSummary
  WINDOW = 7.days
  CAPTURED = %w[CAPTURED PARTIALLY_REFUNDED].freeze
  # A PayPal order the buyer never approved: no money was authorized, so it is not a payment yet.
  NOT_AUTHORIZED = %w[CREATED].freeze

  def initialize(user, now: Time.current)
    @user = user
    @now = now
  end

  def to_h
    {
      scope: customer? ? "own" : "all",
      window_days: customer? ? nil : WINDOW.in_days.to_i,
      pipeline: pipeline,
      next_step: next_step
    }
  end

  private

  def customer?
    @user.customer?
  end

  # Payments that went through PayPal (live or simulated sandbox), not the legacy scored-only rows.
  def payments
    @payments ||= begin
      scope = Transaction.where.not(paypal_status: [ nil, *NOT_AUTHORIZED ])
      customer? ? scope.where(user: @user) : scope.where(created_at: (@now - WINDOW)..)
    end
  end

  def with_evaluation
    payments.joins(:fraud_evaluation)
  end

  def pipeline
    ml_flagged = with_evaluation.where(status: "FLAGGED").where("fraud_evaluations.rules_triggered LIKE ?", "%ML_RISK_SCORE%").count
    {
      authorized: payments.count,
      rules_blocked: payments.where(status: "BLOCKED").count,
      rules_flagged: payments.where(status: "FLAGGED").count - ml_flagged,
      model_flagged: ml_flagged,
      ai_read: with_evaluation.where.not(fraud_evaluations: { ai_verdict: nil }).count,
      ai_escalated: with_evaluation.where("fraud_evaluations.ai_verdict ->> 'action' IN ('review', 'block')").count,
      human_decided: with_evaluation.where.not(fraud_evaluations: { human_label: nil }).count,
      captured: payments.where(paypal_status: CAPTURED).count,
      held: payments.where(paypal_status: "HELD").count,
      voided: payments.where(paypal_status: "VOIDED").count,
      refunded: payments.where(paypal_status: "REFUNDED").count
    }
  end

  def next_step
    case @user.role
    when "customer" then customer_step
    when "admin" then admin_step
    else review_step
    end
  end

  # A customer with a held payment is told it waits for a reviewer; otherwise the next step is to pay.
  def customer_step
    own = @user.transactions.where.not(paypal_status: [ nil, *NOT_AUTHORIZED ]).order(created_at: :desc)
    held = own.where(paypal_status: "HELD")
    shown = held.first || own.first
    return { kind: "pay", count: 0 } unless shown

    { kind: held.exists? ? "wait" : "pay", count: held.exists? ? held.count : own.count,
      latest: { amount: shown.amount.to_f, paypal_status: shown.paypal_status, created_at: shown.created_at } }
  end

  # Analysts and reviewers start at the oldest payment still waiting for a person.
  def review_step
    oldest = Transaction.where(paypal_status: "HELD").order(:created_at).first
    return { kind: "queue_empty", count: 0 } unless oldest

    { kind: "review", count: Transaction.where(paypal_status: "HELD").count,
      oldest: { amount: oldest.amount.to_f, risk_score: oldest.risk_score, created_at: oldest.created_at } }
  end

  # Admins settle requests first, since a reviewer is waiting on them; then the queue.
  def admin_step
    pending = ApprovalRequest.pending
    return review_step if pending.none?

    oldest = pending.order(:created_at).first
    { kind: "approvals", count: pending.count, oldest: { action: oldest.action, created_at: oldest.created_at } }
  end
end
