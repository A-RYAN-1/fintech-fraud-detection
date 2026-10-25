# Builds the only input the AI analyst ever sees. Every value is a band, a flag, a rule name or a model label:
# no user id, email, IP address, device id or transaction id leaves the server.
class AiFactsBuilder
  def initialize(transaction, user, stats, rule_results)
    @transaction = transaction
    @user = user
    @stats = stats
    @rules = rule_results
  end

  def facts
    ml = @rules[:ml]
    {
      amount_band_usd: AiAnalyst.amount_band(@transaction.amount),
      payment_method: @transaction.payment_method,
      time_of_day_utc: MlFeatureBuilder::NIGHT_HOURS.cover?(@transaction.created_at.utc.hour) ? "night (00:00 to 06:00)" : "day",
      first_transaction_of_user: @stats.total_txns.zero?,
      amount_vs_user_average: ratio_band,
      transactions_by_user_last_hour: earlier.where("created_at > ?", 1.hour.ago).count.clamp(0, 10),
      device: device_state,
      rules_decision: AiAnalyst::STATUS_TO_ACTION.fetch(@rules[:status]),
      rules_risk_score: @rules[:risk_score],
      rules_triggered: @rules[:triggered_rules],
      model_risk_probability: ml ? ml[:probability].round(2) : nil,
      model_top_reasons: ml ? ml[:reasons].map { |r| r[:label] } : []
    }
  end

  private

  def earlier
    @user.transactions.where.not(id: @transaction.id)
  end

  def ratio_band
    avg = @stats.avg_amount.to_f
    return "no history" if avg <= 0

    ratio = @transaction.amount.to_f / avg
    if ratio < 1.5 then "about the average"
    elsif ratio < 3 then "1.5 to 3 times the average"
    elsif ratio < 10 then "3 to 10 times the average"
    else "more than 10 times the average"
    end
  end

  def device_state
    return "missing" if @transaction.device_id.blank?

    trusted = @user.devices.first
    return "no trusted device yet" if trusted.nil?

    trusted.device_id == @transaction.device_id ? "trusted" : "different from the trusted device"
  end
end
