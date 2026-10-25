# The admin-set limits on money the agent may capture without a human (stored in the editable rules table).
module AutoCaptureLimits
  # Money captured by the agent today (UTC), not counting payments a human approved.
  def self.captured_today(now: Time.current)
    Transaction.where(paypal_capture_mode: "auto", paypal_captured_at: now.utc.beginning_of_day..).sum(:amount)
  end

  # nil when the payment fits, otherwise a sentence saying which limit it breaks.
  def self.breach(amount, now: Time.current)
    max = RiskRuleConfig.get(:max_auto_capture_amount)
    return "Amount #{amount.to_s('F')} is above the auto-capture limit of #{max.to_s('F')}; a human decides" if amount > max

    cap = RiskRuleConfig.get(:daily_auto_capture_cap)
    today = captured_today(now: now)
    return "Capturing it would take today's auto-captures past the daily cap of #{cap.to_s('F')} (#{today.to_s('F')} so far); a human decides" if today + amount > cap

    nil
  end
end
