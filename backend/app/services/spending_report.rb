# A customer's own money for the My Spending page: what was captured (spent), what waits for a reviewer, what was
# voided, and which rules held or blocked their payments. Only PayPal payments, only this customer's.
class SpendingReport
  PERIODS = InsightsReport::PERIODS
  CAPTURED = InsightsReport::CAPTURED

  def initialize(user, period: "30d", now: Time.current)
    @user = user
    @days = PERIODS.fetch(period.to_s, 30)
    @now = now
    @from = (now - (@days - 1).days).beginning_of_day
  end

  def to_h
    captured = payments.where(paypal_status: CAPTURED)
    held = payments.where(paypal_status: "HELD")
    voided = payments.where(paypal_status: "VOIDED")
    refunded = payments.sum(:refunded_amount).to_f
    {
      period_days: @days,
      spent: (captured.sum(:amount).to_f - refunded).round(2),
      captured_count: captured.count,
      held: { count: held.count, amount: held.sum(:amount).to_f },
      voided: { count: voided.count, amount: voided.sum(:amount).to_f },
      refunded_amount: refunded,
      daily: daily,
      reasons: reasons
    }
  end

  private

  def payments
    @payments ||= @user.transactions.where.not(paypal_status: [ nil, *HomeSummary::NOT_AUTHORIZED ]).where(created_at: @from..@now)
  end

  def daily
    rows = payments.group("DATE(transactions.created_at)").pluck(
      Arel.sql("DATE(transactions.created_at)"),
      Arel.sql("COALESCE(SUM(amount - refunded_amount) FILTER (WHERE paypal_status IN ('CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED')), 0)"),
      Arel.sql("COALESCE(SUM(amount) FILTER (WHERE paypal_status = 'HELD'), 0)"),
      Arel.sql("COALESCE(SUM(amount) FILTER (WHERE paypal_status = 'VOIDED'), 0)")
    ).to_h { |date, spent, held, voided| [ date.to_date, [ spent.to_f, held.to_f, voided.to_f ] ] }

    (0...@days).map do |offset|
      date = @from.to_date + offset
      spent, held, voided = rows.fetch(date, [ 0.0, 0.0, 0.0 ])
      { date: date.iso8601, spent: spent, held: held, voided: voided }
    end
  end

  # Why this customer's payments were held or voided: the rules (and the model flag) on those payments.
  def reasons
    counts = Hash.new(0)
    FraudEvaluation.where(transaction_id: payments.where(paypal_status: %w[HELD VOIDED]).select(:id))
                   .where.not(rules_triggered: [ nil, "" ]).pluck(:rules_triggered).each do |rules|
      rules.split(",").map(&:strip).reject(&:empty?).each { |rule| counts[rule] += 1 }
    end
    counts.sort_by { |rule, count| [ -count, rule ] }.map { |rule, count| { rule: rule, count: count } }
  end
end
