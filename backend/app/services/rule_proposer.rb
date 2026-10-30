# After a person overrides the rules, drafts one change to one rule and backtests it. The draft is stored as pending; an
# admin accepts or rejects it. Nothing here writes risk_rule_settings.
#
# Two kinds of override start a draft:
#   false_alarm  the rules held or blocked a payment and the person approved it
#   miss         the rules approved a payment and the person blocked it
# Candidates are the rule scores that fired and the thresholds. A change must (1) be a legal rule value, (2) change the
# outcome of the payment that started it, (3) not create a new miss when the trigger is a false alarm. The reversible
# action comes first: a missed payment is moved to FLAGGED (held for a person), never straight to BLOCKED, and a
# blocked false alarm is moved to FLAGGED, not to approved.
class RuleProposer
  SCORE_KEYS = {
    "FIRST_TRANSACTION_HIGH_AMOUNT" => "first_txn_high_risk",
    "AMOUNT_DEVIATION_HIGH" => "amount_deviation_high",
    "AMOUNT_DEVIATION_MEDIUM" => "amount_deviation_medium",
    "AMOUNT_DEVIATION_LOW" => "amount_deviation_low",
    "RAPID_MEDIUM_AMOUNT" => "rapid_velocity_low",
    "RAPID_LARGE_AMOUNT" => "rapid_velocity_medium",
    "RAPID_VERY_LARGE_AMOUNT" => "rapid_velocity_high",
    "UNTRUSTED_DEVICE" => "untrusted_device_risk",
    "MISSING_DEVICE_ID" => "missing_device_risk"
  }.freeze

  Candidate = Struct.new(:key, :value, :report, keyword_init: true)

  class << self
    # Called after a label is written. Never raises: a failed draft must not undo a person's decision.
    def after_label(evaluation)
      new(evaluation).propose
    rescue StandardError => e
      Rails.logger.error("RuleProposer failed for evaluation=#{evaluation&.id}: #{e.class} #{e.message}")
      nil
    end
  end

  def initialize(evaluation)
    @evaluation = evaluation
    @payment = evaluation.financial_transaction
  end

  # The stored RuleProposal, or nil when no override needs one or no safe change exists.
  def propose
    kind = trigger_kind
    return nil if kind.nil?

    best = candidates(kind).filter_map { |key, value| evaluate(key, value, kind) }.min_by { |candidate| rank(candidate) }
    return nil if best.nil?
    return nil if RuleProposal.pending.exists?(key: best.key, proposed_value: best.value)

    store(best, kind)
  end

  # Why no draft exists for this payment, in a sentence a person can read.
  def reason_none
    return "This payment has no human decision yet" if @evaluation.human_label.blank?
    return "The rules and the person agreed, so there is nothing to change" if trigger_kind.nil?

    "No single rule change fixes this payment without creating a new miss"
  end

  def trigger_kind
    return nil if @evaluation.human_label.blank?

    risky = !@payment.success?
    return "false_alarm" if risky && @evaluation.human_label == "approve"
    return "miss" if !risky && @evaluation.human_label == "block"

    nil
  end

  private

  def candidates(kind)
    config = RiskRuleConfig.values
    score = @evaluation.risk_score
    flag = config["flag_threshold"]
    block = config["block_threshold"]
    keys = triggered_keys
    list = {}

    if kind == "false_alarm"
      if @payment.blocked?
        list["block_threshold"] = BigDecimal(score + 1)
        keys.each { |key| list[key] = config[key] - (score - (block - 1)) }
      else
        list["flag_threshold"] = BigDecimal(score + 1)
        keys.each { |key| list[key] = config[key] - (score - (flag - 1)) }
      end
    else
      list["flag_threshold"] = BigDecimal(score) if score >= 1
      keys.each { |key| list[key] = config[key] + (flag - score) }
    end

    list.filter_map { |key, value| [ key, value ] if legal?(key, value, config) }
  end

  def triggered_keys
    @evaluation.rules_triggered.to_s.split(",").filter_map { |rule| SCORE_KEYS[rule] }.uniq
  end

  def legal?(key, value, config)
    return false if value == config[key]

    # The same record the accept step saves: a key that already has a row is updated, not created.
    RiskRuleSetting.find_or_initialize_by(key: key).tap { |setting| setting.value = value }.valid?
  end

  def evaluate(key, value, kind)
    report = RuleBacktest.new({ key => value }, focus: @payment.id).call
    candidate = Candidate.new(key: key, value: value, report: report)
    return nil unless fixes_trigger?(candidate, kind)
    return nil if kind == "false_alarm" && report[:delta][:misses].positive?

    candidate
  end

  def fixes_trigger?(candidate, kind)
    focus = candidate.report[:focus]
    return false if focus.nil? || focus[:from] == focus[:to]

    if kind == "false_alarm"
      @payment.blocked? ? focus[:to] != "BLOCKED" : focus[:to] == "SUCCESS"
    else
      focus[:to] != "SUCCESS"
    end
  end

  # Lowest first: misses, then false alarms, then how many payments change tier, then the size of the change.
  def rank(candidate)
    delta = candidate.report[:delta]
    moved = delta.slice(:success, :flagged, :blocked).values.sum(&:abs)
    [ delta[:misses], delta[:false_alarms], moved, (candidate.value - RiskRuleConfig.get(candidate.key)).abs ]
  end

  def store(candidate, kind)
    current = RiskRuleConfig.get(candidate.key)
    proposal = RuleProposal.create!(
      key: candidate.key, current_value: current, proposed_value: candidate.value, trigger_kind: kind, source_payment: @payment,
      rationale: rationale(candidate, kind, current), backtest: candidate.report
    )
    AuditLog.record!(event_type: "RULE_PROPOSAL_DRAFTED", entity_type: "RiskRule", entity_id: candidate.key, actor: "Agent",
                     description: "Agent drafted a change to #{candidate.key} from #{pretty(current)} to #{pretty(candidate.value)} after #{@evaluation.labeled_by&.email || 'a person'} overrode payment #{@payment.id}. Not applied; an admin decides.",
                     after: { proposal_id: proposal.id, key: candidate.key, proposed_value: pretty(candidate.value) })
    proposal
  end

  def rationale(candidate, kind, current)
    who = @evaluation.labeled_by&.email || "A person"
    rules = @evaluation.rules_triggered.to_s.split(",").join(", ").presence || "no rule"
    delta = candidate.report[:delta]
    outcome = kind == "false_alarm" ? "approved a payment the rules #{@payment.blocked? ? 'blocked' : 'held'}" : "blocked a payment the rules approved"
    "#{who} #{outcome} (score #{@evaluation.risk_score}, fired: #{rules}). Changing #{candidate.key} from #{pretty(current)} to #{pretty(candidate.value)} " \
      "would have changed that payment and, over #{candidate.report[:replayed]} stored payments, moves false alarms by #{signed(delta[:false_alarms])} and misses by #{signed(delta[:misses])}."
  end

  def signed(number)
    number.positive? ? "+#{number}" : number.to_s
  end

  def pretty(number)
    number.to_s("F").sub(/\.0+\z/, "")
  end
end
