# Ask the analyst: one turn of "why this verdict" or "what would change it" about a stored case, for staff.
# The input is the same facts-only payload the verdict used (AiFactsBuilder, with the ring bands), rebuilt from what
# was stored; no ids, emails, IP addresses or device ids, no tools, no free text from the asker (the question is one of
# AiAnalyst::QUESTIONS). The answer is advice on screen: nothing is saved and no decision changes.
# When the analyst is off, skipped by its guard or fails, a fixed rules-only answer built from the same facts is
# returned and marked source "rules", so the button never dead-ends.
class AskAnalyst
  def initialize(transaction, analyst: AiAnalyst.new)
    @transaction = transaction
    @analyst = analyst
  end

  def ask(question)
    facts = self.facts
    result = @analyst.answer(facts, question)
    return { question: question, answer: result[:answer], source: "ai", model: result[:model] } if result

    { question: question, answer: RulesAnswer.new(facts).for(question), source: "rules", model: nil }
  end

  def facts
    evaluation = @transaction.fraud_evaluation
    user = @transaction.user
    stats = user.user_transaction_stat || user.build_user_transaction_stat
    AiFactsBuilder.new(@transaction, user, stats, rule_results(evaluation)).facts
  end

  private

  def rule_results(evaluation)
    status = @transaction.status.to_s.downcase.to_sym
    results = { status: AiAnalyst::STATUS_TO_ACTION.key?(status) ? status : :flagged,
                risk_score: evaluation&.risk_score.to_i, triggered_rules: evaluation&.rules_triggered.to_s.split(",") }
    if evaluation&.ml_score
      reasons = Array(evaluation.ml_explanation).map { |r| r.to_h.symbolize_keys }
      results[:ml] = { probability: evaluation.ml_score, reasons: reasons }
    end
    results
  end

  # The fixed answer used when the analyst cannot be asked.
  class RulesAnswer
    def initialize(facts)
      @facts = facts
    end

    def for(question)
      question.to_s == "change" ? change : why
    end

    private

    def why
      rules = @facts[:rules_triggered]
      parts = [ "The rules decision is #{@facts[:rules_decision]} with a risk score of #{@facts[:rules_risk_score]}." ]
      parts << (rules.empty? ? "No rule fired." : "Rules that fired: #{rules.join(', ')}.")
      parts << "Amount #{@facts[:amount_band_usd]} USD, device: #{@facts[:device]}, linked accounts: #{@facts[:linked_accounts]}."
      parts << "Model reasons: #{@facts[:model_top_reasons].first(3).join('; ')}." if @facts[:model_top_reasons].any?
      parts << "The AI analyst could not be reached, so this is the rules-only explanation."
      parts.join(" ")
    end

    def change
      checks = []
      checks << "a trusted device (now: #{@facts[:device]})" unless @facts[:device] == "trusted"
      checks << "an amount near the customer average (now: #{@facts[:amount_vs_user_average]})" unless @facts[:amount_vs_user_average] == "about the average"
      checks << "no accounts linked through shared devices (now: #{@facts[:linked_accounts]})" unless @facts[:linked_accounts] == "none"
      checks << "no rule firing (now: #{@facts[:rules_triggered].join(', ')})" if @facts[:rules_triggered].any?
      lead = checks.empty? ? "Nothing in the facts pushes this case up; a reviewer would look at the model reasons and the history." : "Facts that would lower the risk: #{checks.join('; ')}."
      "#{lead} Linked accounts that a person voided (now: #{@facts[:linked_accounts_voided_by_a_person]}) would raise it. The AI analyst could not be reached, so this is the rules-only answer."
    end
  end
end
