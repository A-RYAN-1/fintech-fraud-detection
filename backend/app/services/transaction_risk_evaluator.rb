class TransactionRiskEvaluator
  def initialize(transaction)
    @transaction = transaction
    @user = transaction.user
  end

  def evaluate
    stats = @user.user_transaction_stat || @user.create_user_transaction_stat

    # 1. Processing Risk Rules, then the model and the AI analyst. The analyst is a network call, so it runs
    # before the database transaction opens instead of holding a connection while it waits.
    rule_results = RiskRulesProcessor.new(@transaction, @user, stats).process
    rule_results = add_ml_score(rule_results, stats)
    rule_results = add_ai_verdict(rule_results, stats)

    # Ensure atomicity: if any step fails (e.g. AuditLog creation),
    # all changes (Transaction status, FraudEvaluation) are rolled back.
    ActiveRecord::Base.transaction do
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

  # The verdict is stored and shown next to the rules decision; it does not change the status in this layer.
  def add_ai_verdict(rule_results, stats)
    verdict = AiAnalyst.new.verdict(AiFactsBuilder.new(@transaction, @user, stats, rule_results).facts)
    verdict ? rule_results.merge(ai: verdict) : rule_results
  end

  # The model may lift a SUCCESS to FLAGGED and explain itself; it never blocks and never lowers a rule result.
  def add_ml_score(rule_results, stats)
    vector = MlFeatureBuilder.new(@transaction, @user, stats).vector
    ml = MlRiskScorer.score(vector)
    return rule_results unless ml

    results = rule_results.merge(ml: ml.merge(features: vector))
    return results unless ml[:flag] && rule_results[:status] == :success

    results.merge(
      status: :flagged,
      risk_score: RiskRuleConfig.get(:flag_threshold).to_i,
      triggered_rules: rule_results[:triggered_rules] + [ "ML_RISK_SCORE" ]
    )
  end
end
