# Staff-wide numbers for the Insights page: every PayPal payment in the period, counts and amounts only, never who
# paid. It answers what moved, what was stopped and why, how the model and the AI analyst voted, and how long a
# held payment waited for a person.
class InsightsReport
  PERIODS = { "7d" => 7, "30d" => 30, "90d" => 90 }.freeze
  CAPTURED = %w[CAPTURED PARTIALLY_REFUNDED REFUNDED].freeze
  RISK_RANGES = [ [ 0, 29 ], [ 30, 49 ], [ 50, 69 ], [ 70, 100 ] ].freeze
  TOP_RULES = 6

  attr_reader :days

  def initialize(period: "7d", now: Time.current)
    @days = PERIODS.fetch(period.to_s, 7)
    @now = now
    @from = (now - (days - 1).days).beginning_of_day
  end

  def to_h
    {
      period_days: days,
      totals: totals,
      daily: daily,
      risk_ranges: risk_ranges,
      top_rules: top_rules,
      model: model,
      ai: ai,
      decision_time: decision_time
    }
  end

  private

  def payments
    @payments ||= Transaction.where.not(paypal_status: [ nil, *HomeSummary::NOT_AUTHORIZED ]).where(created_at: @from..@now)
  end

  def evaluations
    FraudEvaluation.where(transaction_id: payments.select(:id))
  end

  def totals
    by_status = payments.group(:paypal_status).count
    {
      payments: payments.count,
      volume: payments.sum(:amount).to_f,
      captured_amount: payments.where(paypal_status: CAPTURED).sum(:amount).to_f,
      refunded_amount: payments.sum(:refunded_amount).to_f,
      captured: CAPTURED.sum { |s| by_status[s].to_i },
      held: by_status["HELD"].to_i,
      voided: by_status["VOIDED"].to_i,
      blocked_by_rules: payments.where(status: "BLOCKED").count,
      auto_captured: payments.where(paypal_capture_mode: "auto").count
    }
  end

  def daily
    rows = payments.group("DATE(transactions.created_at)").pluck(
      Arel.sql("DATE(transactions.created_at)"), Arel.sql("COUNT(*)"), Arel.sql("SUM(amount)"),
      Arel.sql("COUNT(*) FILTER (WHERE paypal_status = 'HELD' OR status = 'FLAGGED')"),
      Arel.sql("COUNT(*) FILTER (WHERE status = 'BLOCKED')")
    ).to_h { |date, count, sum, held, blocked| [ date.to_date, [ count, sum.to_f, held, blocked ] ] }

    (0...days).map do |offset|
      date = @from.to_date + offset
      count, volume, held, blocked = rows.fetch(date, [ 0, 0.0, 0, 0 ])
      { date: date.iso8601, payments: count, volume: volume, flagged: held, blocked: blocked }
    end
  end

  def risk_ranges
    RISK_RANGES.map do |min, max|
      { range: "#{min}-#{max}", min: min, max: max, count: payments.where(risk_score: min..max).count }
    end
  end

  def top_rules
    counts = Hash.new(0)
    evaluations.where.not(rules_triggered: [ nil, "" ]).pluck(:rules_triggered).each do |rules|
      rules.split(",").map(&:strip).reject(&:empty?).each { |rule| counts[rule] += 1 }
    end
    counts.sort_by { |rule, count| [ -count, rule ] }.first(TOP_RULES).map { |rule, count| { rule: rule, count: count } }
  end

  def model
    scored = evaluations.where.not(ml_score: nil)
    flagged = scored.where("ml_score >= ?", MlRiskScorer.model.fetch("flag_threshold")).count
    total = scored.count
    { scored: total, flagged: flagged, flag_rate: total.zero? ? nil : (flagged.to_f / total).round(4) }
  end

  def ai
    actions = evaluations.where.not(ai_verdict: nil).group(Arel.sql("ai_verdict ->> 'action'")).count
    { read: actions.values.sum, approve: actions["approve"].to_i, review: actions["review"].to_i, block: actions["block"].to_i }
  end

  # Minutes from the payment to the person's decision, for payments a person decided.
  def decision_time
    minutes = evaluations.where(label_source: "decision").where.not(labeled_at: nil)
                         .joins(:financial_transaction).pluck("fraud_evaluations.labeled_at", "transactions.created_at")
                         .map { |labeled, created| ((labeled - created) / 60.0).clamp(0, Float::INFINITY) }.sort
    return { decided: 0, median_minutes: nil, p90_minutes: nil } if minutes.empty?

    { decided: minutes.size, median_minutes: percentile(minutes, 0.5).round(1), p90_minutes: percentile(minutes, 0.9).round(1) }
  end

  # Nearest-rank percentile of a sorted list.
  def percentile(sorted, fraction)
    sorted[(fraction * sorted.size).ceil.clamp(1, sorted.size) - 1]
  end
end
