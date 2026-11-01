# Case narrative: a short, regulator-style write-up of one stored case for the reviewer to attach to a decision.
# Input is the same facts-only payload the verdict used (AskAnalyst#facts), so no ids, emails, IP addresses or device ids
# reach the model, and the call has no tools. The draft is saved as an audit row (CASE_NARRATIVE) with who asked for it
# and whether the AI analyst or the fixed rules-only template wrote it; it never changes the payment or the decision.
class CaseNarrative
  EVENT = "CASE_NARRATIVE".freeze

  def initialize(transaction, analyst: AiAnalyst.new)
    @transaction = transaction
    @analyst = analyst
  end

  def draft!(actor:)
    facts = AskAnalyst.new(@transaction).facts
    ai = @analyst.narrative(facts)
    # A draft that cites anything outside the facts is replaced by the fixed template (AnalystGrounding).
    check = ai && AnalystGrounding.check([ ai[:summary], *ai[:indicators], *ai[:reviewer_checks] ], facts)
    grounded = ai && check.passed
    body = grounded ? ai.slice(:summary, :indicators, :reviewer_checks) : RulesNarrative.new(facts).to_h
    source = grounded ? "ai" : "rules"
    model = grounded ? ai[:model] : nil
    grounding = ai ? check.to_h : AnalystGrounding::NOT_APPLICABLE
    log = AuditLog.record!(event_type: EVENT, entity_type: "Transaction", entity_id: @transaction.id,
                           description: "#{actor.email} drafted a case narrative (#{source}#{', AI draft rejected' if ai && !grounded})", actor: actor,
                           after: body.merge(source: source, model: model, grounding: grounding))
    body.merge(source: source, model: model, grounding: grounding, created_at: log.created_at)
  end

  # The fixed template used when the analyst is off, skipped by its guard, or fails.
  class RulesNarrative
    def initialize(facts)
      @facts = facts
    end

    def to_h
      { summary: summary, indicators: indicators, reviewer_checks: checks }
    end

    private

    def summary
      rules = @facts[:rules_triggered]
      fired = rules.empty? ? "no rule fired" : "rules fired: #{rules.join(', ')}"
      "A payment in the #{@facts[:amount_band_usd]} USD band was held with a rules decision of #{@facts[:rules_decision]} " \
        "(risk score #{@facts[:rules_risk_score]}); #{fired}. The AI analyst was not available, so this is the fixed rules-only narrative."
    end

    def indicators
      items = []
      items << "Device: #{@facts[:device]}" unless @facts[:device] == "trusted"
      items << "Amount compared with the customer average: #{@facts[:amount_vs_user_average]}" unless @facts[:amount_vs_user_average] == "about the average"
      items << "Accounts linked through shared devices: #{@facts[:linked_accounts]}" unless @facts[:linked_accounts] == "none"
      items.concat(@facts[:model_top_reasons].first(2).map { |reason| "Model reason: #{reason}" })
      items << "No elevated indicator in the stored facts" if items.empty?
      items.first(AiAnalyst::MAX_NARRATIVE_ITEMS)
    end

    def checks
      checks = []
      checks << "Confirm the device with the customer" unless @facts[:device] == "trusted"
      checks << "Confirm the amount is expected for this customer" unless @facts[:amount_vs_user_average] == "about the average"
      checks << "Look at the linked accounts panel before deciding" unless @facts[:linked_accounts] == "none"
      checks << "Review the rule hits and model reasons on the case" if checks.empty?
      checks
    end
  end
end
