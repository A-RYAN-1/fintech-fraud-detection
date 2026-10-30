module Api
  module V1
    module Admin
      # Rule changes the agent drafted after a person overrode the rules, each with its backtest. Staff read them; only an
      # admin accepts one, and accepting is the only way a draft reaches the live rules.
      class RuleProposalsController < BaseController
        include Idempotent

        before_action :require_staff!, only: [ :index, :create ]
        before_action :require_admin!, only: [ :accept, :reject ]
        idempotent :accept, :reject

        # GET /api/v1/admin/rule_proposals?status=pending|accepted|rejected|superseded|all
        def index
          status = params[:status].presence || "pending"
          return render_error("Invalid status", :unprocessable_entity) unless status == "all" || RuleProposal.statuses.key?(status)

          scope = RuleProposal.includes(:decided_by).order(created_at: :desc, id: :desc)
          scope = scope.where(status: status) unless status == "all"
          records, meta = paginate(scope)
          render_success({ rule_proposals: records.map { |proposal| serialize(proposal) }, meta: meta })
        end

        # POST /api/v1/admin/rule_proposals  { transaction_id: "..." }  drafts a change from one decided payment
        def create
          payment = Transaction.find_by(id: params[:transaction_id])
          evaluation = payment&.fraud_evaluation
          return render_error("Payment not found", :not_found) unless evaluation

          proposer = RuleProposer.new(evaluation)
          proposal = proposer.propose
          return render_error(proposer.reason_none, :unprocessable_entity) unless proposal

          render_success(serialize(proposal), "Change drafted; it is not applied until an admin accepts it", :created)
        end

        # POST /api/v1/admin/rule_proposals/:id/accept  { note: "..." }
        def accept
          proposal = RuleProposal.find_by(id: params[:id])
          return render_error("Proposal not found", :not_found) unless proposal
          return render_error("This proposal was already #{proposal.status}", :conflict) unless proposal.pending?

          if RiskRuleConfig.get(proposal.key) != proposal.current_value
            proposal.update!(status: :superseded, decided_by: current_user, decided_at: Time.current, decision_note: "Rule changed since this was drafted")
            return render_error("#{proposal.key} changed since this was drafted, so the backtest no longer applies. Ask for a new draft.", :conflict)
          end

          setting = RiskRuleSetting.find_or_initialize_by(key: proposal.key)
          setting.assign_attributes(value: proposal.proposed_value, updated_by: current_user)
          return render_error(setting.errors.full_messages.to_sentence, :unprocessable_entity) unless setting.valid?

          ActiveRecord::Base.transaction do
            setting.save!
            proposal.update!(status: :accepted, decided_by: current_user, decided_at: Time.current, decision_note: note)
            AuditLog.record!(event_type: "RISK_RULE_CHANGED", entity_type: "RiskRule", entity_id: proposal.key, actor: current_user,
                             description: "#{current_user.email} accepted the agent draft: #{proposal.key} from #{pretty(proposal.current_value)} to #{pretty(proposal.proposed_value)}",
                             before: { value: pretty(proposal.current_value) }, after: { value: pretty(proposal.proposed_value), proposal_id: proposal.id }, reason: note)
          end
          RiskRuleConfig.reset_cache!
          render_success(serialize(proposal.reload), "Rule changed")
        end

        # POST /api/v1/admin/rule_proposals/:id/reject  { note: "..." }
        def reject
          proposal = RuleProposal.find_by(id: params[:id])
          return render_error("Proposal not found", :not_found) unless proposal
          return render_error("This proposal was already #{proposal.status}", :conflict) unless proposal.pending?

          ActiveRecord::Base.transaction do
            proposal.update!(status: :rejected, decided_by: current_user, decided_at: Time.current, decision_note: note)
            AuditLog.record!(event_type: "RULE_PROPOSAL_REJECTED", entity_type: "RiskRule", entity_id: proposal.key, actor: current_user,
                             description: "#{current_user.email} rejected the agent draft for #{proposal.key} (#{pretty(proposal.current_value)} to #{pretty(proposal.proposed_value)})",
                             reason: note)
          end
          render_success(serialize(proposal.reload), "Proposal rejected")
        end

        private

        def note
          params[:note].to_s.squish.first(200).presence
        end

        def pretty(number)
          number.to_s("F").sub(/\.0+\z/, "")
        end

        def serialize(proposal)
          definition = RiskRuleConfig::DEFINITIONS.fetch(proposal.key)
          {
            id: proposal.id,
            key: proposal.key,
            description: definition.description,
            current_value: proposal.current_value.to_f,
            proposed_value: proposal.proposed_value.to_f,
            live_value: RiskRuleConfig.get(proposal.key).to_f,
            trigger_kind: proposal.trigger_kind,
            transaction_id: proposal.source_payment_id,
            rationale: proposal.rationale,
            backtest: proposal.backtest,
            status: proposal.status,
            decided_by: proposal.decided_by&.email,
            decided_at: proposal.decided_at,
            decision_note: proposal.decision_note,
            created_at: proposal.created_at
          }
        end
      end
    end
  end
end
