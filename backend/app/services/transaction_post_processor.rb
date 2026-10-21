class TransactionPostProcessor
  def initialize(transaction, user, stats, evaluation_results)
    @transaction = transaction
    @user = user
    @stats = stats
    @result = evaluation_results
    @status = @result[:status]
    @risk_score = @result[:risk_score]
    @triggered_rules = @result[:triggered_rules]
  end

  def process
    save_fraud_evaluation!
    update_transaction_status!
    send_notifications!
    create_audit_log!
    learn_behavior_if_successful!
  end

  private

  def save_fraud_evaluation!
    FraudEvaluation.create!(
      financial_transaction: @transaction,
      risk_score: @risk_score,
      rules_triggered: @triggered_rules.join(','),
      **ml_attributes
    )
  end

  def ml_attributes
    ml = @result[:ml]
    return {} unless ml

    { ml_score: ml[:probability], ml_version: ml[:version], ml_explanation: ml[:reasons] }
  end

  def update_transaction_status!
    @transaction.update!(status: @status, risk_score: @risk_score)

    # Alert if blocked
    TransactionMailer.blocked_alert(@transaction).deliver_later if @status == :blocked
  end

  def send_notifications!
    if [:blocked, :flagged].include?(@status)
      Notification.create_transaction_notification(
        user: @user,
        transaction: @transaction,
        status: @status.to_s.upcase
      )
    end
  end

  def create_audit_log!
    AuditLog.create!(
      event_type: "TRANSACTION_#{@status.to_s.upcase}",
      entity_type: 'Transaction',
      entity_id: @transaction.id,
      description: "Triggered rules: #{@triggered_rules.join(',')}"
    )
  end

  def learn_behavior_if_successful!
    return unless @status == :success

    update_user_stats!
    store_device_if_none!
  end

  def update_user_stats!
    new_total_txns = @stats.total_txns + 1
    new_total_amount = @stats.total_amount + @transaction.amount
    new_avg_amount = new_total_amount / new_total_txns

    @stats.update!(
      total_txns: new_total_txns,
      total_amount: new_total_amount,
      avg_amount: new_avg_amount,
      last_updated_at: Time.current
    )
  end

  def store_device_if_none!
    trusted_device = @user.devices.first
    return if trusted_device.present? || @transaction.device_id.blank?

    @user.devices.create!(
      device_id: @transaction.device_id,
      first_seen_at: Time.current
    )
  end
end
