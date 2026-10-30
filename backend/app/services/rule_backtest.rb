# Replays stored payments through RiskRulesProcessor with the current rule values and again with a candidate change, and
# counts what each would have decided. Read-only: it writes nothing and never touches the live rule values.
#
# Each payment is replayed with the history it had when it was made: the user's average and count of earlier approved
# payments, the payments in the velocity window, and the trusted device. The model's lift from approved to flagged is
# kept as stored (a stored score at or above the model's threshold). Two things are approximations, and the report says so:
# the stats follow what actually happened, not what the candidate would have changed, and the trusted device is the
# user's first device today.
class RuleBacktest
  MAX_PAYMENTS = 20_000
  MAX_FLIPS = 10

  Row = Struct.new(:id, :amount, :device_id, :stored_status, :ml_flag, :label, :stats, :history, keyword_init: true)
  Stats = Struct.new(:total_txns, :avg_amount)
  Payment = Struct.new(:amount, :device_id)

  # focus: the id of one payment whose before and after status is returned as :focus, even when it is not among the flips shown.
  def initialize(overrides = {}, focus: nil)
    @focus = focus
    @overrides = overrides.transform_keys(&:to_s).transform_values { |value| BigDecimal(value.to_s) }
  end

  # { replayed:, labelled:, fidelity:, baseline:, candidate:, delta:, flips:, focus:, notes: }
  def call
    rows = load_rows
    baseline_config = RiskRuleConfig.values
    candidate_config = baseline_config.merge(@overrides)

    baseline = rows.to_h { |row| [ row.id, decide(row, baseline_config) ] }
    candidate = rows.to_h { |row| [ row.id, decide(row, candidate_config) ] }
    matches = rows.count { |row| baseline[row.id] == row.stored_status }

    {
      replayed: rows.size,
      labelled: rows.count(&:label),
      fidelity: { matches: matches, total: rows.size, rate: rows.empty? ? nil : (matches.to_f / rows.size).round(3) },
      baseline: metrics(rows, baseline),
      candidate: metrics(rows, candidate),
      flips: flips(rows, baseline, candidate),
      focus: focus(baseline, candidate),
      notes: "Each payment is replayed with the history it had when it was made. Stats follow what happened, not what the change would have caused."
    }.tap { |report| report[:delta] = report[:candidate].to_h { |key, value| [ key, value - report[:baseline][key] ] } }
  end

  # The status the rules (and the stored model flag) give one payment under a config.
  def decide(row, config)
    result = RiskRulesProcessor.new(Payment.new(row.amount, row.device_id), nil, row.stats, config: config, history: row.history).process
    status = result[:status].to_s.upcase
    status = "FLAGGED" if status == "SUCCESS" && row.ml_flag
    status
  end

  private

  def metrics(rows, decisions)
    labelled = rows.select(&:label)
    {
      success: decisions.values.count("SUCCESS"),
      flagged: decisions.values.count("FLAGGED"),
      blocked: decisions.values.count("BLOCKED"),
      false_alarms: labelled.count { |row| row.label == "approve" && decisions[row.id] != "SUCCESS" },
      misses: labelled.count { |row| row.label == "block" && decisions[row.id] == "SUCCESS" }
    }
  end

  def focus(baseline, candidate)
    return nil unless @focus && baseline.key?(@focus)

    { transaction_id: @focus, from: baseline[@focus], to: candidate[@focus] }
  end

  def flips(rows, baseline, candidate)
    rows.filter_map do |row|
      next if baseline[row.id] == candidate[row.id]

      { transaction_id: row.id, amount: row.amount.to_f, from: baseline[row.id], to: candidate[row.id], human_label: row.label }
    end.first(MAX_FLIPS)
  end

  def load_rows
    threshold = MlRiskScorer.model.fetch("flag_threshold")
    payments = Transaction.where.not(status: "PENDING").order(created_at: :desc, id: :desc).limit(MAX_PAYMENTS).to_a.reverse
    return [] if payments.empty?

    trusted = Device.order(:id).pluck(:user_id, :device_id).each_with_object({}) { |(user_id, device_id), map| map[user_id] ||= device_id }
    window = RiskRuleConfig.get("velocity_window_seconds").to_i.seconds
    evaluations = FraudEvaluation.where(transaction_id: payments.map(&:id)).pluck(:transaction_id, :ml_score, :human_label).to_h { |id, ml, label| [ id, [ ml, label ] ] }

    totals = Hash.new { |hash, user_id| hash[user_id] = { count: 0, sum: BigDecimal("0") } }
    recent = Hash.new { |hash, user_id| hash[user_id] = [] }

    payments.map do |payment|
      total = totals[payment.user_id]
      times = recent[payment.user_id]
      times << payment.created_at
      times.shift while times.first <= payment.created_at - window
      ml_score, label = evaluations[payment.id]
      avg = total[:count].zero? ? BigDecimal("0") : total[:sum] / total[:count]
      row = Row.new(id: payment.id, amount: payment.amount, device_id: payment.device_id, stored_status: payment.status.upcase, ml_flag: !ml_score.nil? && ml_score >= threshold,
                    label: label, stats: Stats.new(total[:count], avg),
                    history: RiskRulesProcessor::History.new(recent_count: times.size, trusted_device_id: trusted[payment.user_id]))
      if payment.status == "success"
        total[:count] += 1
        total[:sum] += payment.amount
      end
      row
    end
  end
end
