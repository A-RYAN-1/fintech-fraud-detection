class TransactionRiskEvaluator
  def initialize(transaction)
    @transaction = transaction
    @user = transaction.user
  end

  def evaluate
    # Ensure atomicity: if any step fails (e.g. AuditLog creation), 
    # all changes (Transaction status, FraudEvaluation) are rolled back.
    ActiveRecord::Base.transaction do
      stats = @user.user_transaction_stat || @user.create_user_transaction_stat

      # 1. Processing Risk Rules
      rule_results = RiskRulesProcessor.new(@transaction, @user, stats).process
      rule_results = add_ml_score(rule_results, stats)

      # 2. Post-Evaluation Actions (DB updates, Notifications, Logging)
      TransactionPostProcessor.new(@transaction, @user, stats, rule_results).process

      # Return the final status
      rule_results[:status]
    end
  rescue ActiveRecord::RecordInvalid => e
    # Optionally log the error or handle it as needed
    # Rails transactions automatically roll back on exceptions.
    Rails.logger.error("Transaction evaluation failed: #{e.message}")
    raise e
  end

  private

  # The model may lift a SUCCESS to FLAGGED and explain itself; it never blocks and never lowers a rule result.
  def add_ml_score(rule_results, stats)
    ml = MlRiskScorer.score(MlFeatureBuilder.new(@transaction, @user, stats).vector)
    return rule_results unless ml

    results = rule_results.merge(ml: ml)
    return results unless ml[:flag] && rule_results[:status] == :success

    results.merge(
      status: :flagged,
      risk_score: RiskRulesProcessor::FLAGGED_SCORE_THRESHOLD,
      triggered_rules: rule_results[:triggered_rules] + [ "ML_RISK_SCORE" ]
    )
  end
end
