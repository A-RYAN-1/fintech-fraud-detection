# Embeds a case after a person decided it, outside the payment lock. A failure leaves the case unindexed (the backfill
# task fills it later); it can never undo or delay the decision.
class CaseEmbeddingJob < ApplicationJob
  queue_as :default

  def perform(evaluation_id)
    evaluation = FraudEvaluation.find_by(id: evaluation_id)
    SimilarCases.new(evaluation.financial_transaction).index! if evaluation&.human_label
  end
end
