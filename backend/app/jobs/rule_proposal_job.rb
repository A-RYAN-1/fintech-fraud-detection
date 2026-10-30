# Drafts a rule change after a person overrode the rules. A job so the replay runs after the person's decision is saved
# and never inside the payment lock; a failure here cannot undo or delay the decision.
class RuleProposalJob < ApplicationJob
  queue_as :default

  def perform(evaluation_id)
    evaluation = FraudEvaluation.find_by(id: evaluation_id)
    RuleProposer.after_label(evaluation) if evaluation
  end
end
