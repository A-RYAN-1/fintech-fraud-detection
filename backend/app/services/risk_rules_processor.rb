class RiskRulesProcessor
  # Every tunable number is read through RiskRuleConfig (defaults in code, overrides in risk_rule_settings).
  VELOCITY_COUNT_MEDIUM = 4
  VELOCITY_COUNT_LARGE = 3
  VELOCITY_COUNT_VERY_LARGE = 2

  # History is set only by RuleBacktest: what the live path reads from the database (the recent payment count and the
  # trusted device) as it stood when the payment was made.
  History = Struct.new(:recent_count, :trusted_device_id, keyword_init: true)

  def initialize(transaction, user, stats, config: RiskRuleConfig.values, history: nil)
    @transaction = transaction
    @user = user
    @stats = stats
    @config = config
    @history = history
    @risk_score = 0
    @triggered_rules = []
  end

  def process
    evaluate_first_transaction
    evaluate_amount_deviation
    evaluate_velocity
    evaluate_device_security

    {
      risk_score: @risk_score,
      triggered_rules: @triggered_rules,
      status: determine_status
    }
  end

  private

  def amount_between?(lower_key, upper_key)
    @transaction.amount >= @config[lower_key] && @transaction.amount < @config[upper_key]
  end

  def add_risk(score, rule)
    @risk_score += score.to_i
    @triggered_rules << rule
  end

  def evaluate_first_transaction
    if @stats.total_txns == 0 && @transaction.amount > @config["high_amount_limit"]
      add_risk(@config["first_txn_high_risk"], "FIRST_TRANSACTION_HIGH_AMOUNT")
    end
  end

  def evaluate_amount_deviation
    return if @stats.avg_amount <= 0

    if @transaction.amount >= @stats.avg_amount * @config["deviation_multiplier_high"]
      add_risk(@config["amount_deviation_high"], "AMOUNT_DEVIATION_HIGH")
    elsif @transaction.amount >= @stats.avg_amount * @config["deviation_multiplier_medium"]
      add_risk(@config["amount_deviation_medium"], "AMOUNT_DEVIATION_MEDIUM")
    elsif @transaction.amount >= @stats.avg_amount * @config["deviation_multiplier_low"]
      add_risk(@config["amount_deviation_low"], "AMOUNT_DEVIATION_LOW")
    end
  end

  def evaluate_velocity
    window = @config["velocity_window_seconds"].to_i.seconds
    recent_txn_count = @history ? @history.recent_count : @user.transactions.where("created_at > ?", window.ago).count

    if amount_between?("medium_amount_min", "large_amount_min") && recent_txn_count >= VELOCITY_COUNT_MEDIUM
      add_risk(@config["rapid_velocity_low"], "RAPID_MEDIUM_AMOUNT")
    elsif amount_between?("large_amount_min", "very_large_amount_min") && recent_txn_count >= VELOCITY_COUNT_LARGE
      add_risk(@config["rapid_velocity_medium"], "RAPID_LARGE_AMOUNT")
    elsif @transaction.amount >= @config["very_large_amount_min"] && recent_txn_count >= VELOCITY_COUNT_VERY_LARGE
      add_risk(@config["rapid_velocity_high"], "RAPID_VERY_LARGE_AMOUNT")
    end
  end

  def evaluate_device_security
    # Rule 4: Device mismatch check
    trusted_device_id = @history ? @history.trusted_device_id : @user.devices.first&.device_id
    if trusted_device_id.present? && trusted_device_id != @transaction.device_id
      add_risk(@config["untrusted_device_risk"], "UNTRUSTED_DEVICE")
    end

    # Rule 5: Missing device guard
    if @transaction.device_id.blank?
      add_risk(@config["missing_device_risk"], "MISSING_DEVICE_ID")
    end
  end

  def determine_status
    if @risk_score >= @config["block_threshold"]
      :blocked
    elsif @risk_score >= @config["flag_threshold"]
      :flagged
    else
      :success
    end
  end
end
