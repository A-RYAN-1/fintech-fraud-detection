module Api
  module V1
    # The owner's side of a mandate: make one (the token is shown once), list, revoke. Staff can see and revoke every one.
    class AgentMandatesController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/agent_mandates
      def index
        scope = current_user.staff? ? AgentMandate.includes(:user) : current_user.agent_mandates
        mandates = scope.order(created_at: :desc).limit(100)
        render_success({ mandates: mandates.map { |m| payload(m) }, scope: current_user.staff? ? "all" : "mine" })
      end

      # POST /api/v1/agent_mandates
      def create
        mandate, token = AgentMandate.issue!(
          user: current_user, label: params.require(:label).to_s.strip, merchant: params.require(:merchant).to_s.strip,
          per_payment_cap: params.require(:per_payment_cap), total_cap: params.require(:total_cap), expires_at: expiry_from_params
        )
        AuditLog.record!(event_type: "MANDATE_CREATED", entity_type: "AgentMandate", entity_id: mandate.id, actor: current_user,
                         description: "#{current_user.email} gave agent #{mandate.label} a mandate for #{mandate.merchant}",
                         after: payload(mandate).except(:id, :owner_email))
        render_success(payload(mandate).merge(token: token), "Mandate created. Copy the token now; it is not shown again.", :created)
      rescue ActiveRecord::RecordInvalid => e
        render_error("Mandate could not be created", :unprocessable_entity, e.record.errors.full_messages)
      end

      # POST /api/v1/agent_mandates/:id/revoke
      def revoke
        mandate = AgentMandate.find(params[:id])
        return render_error("Not authorized", :forbidden) unless mandate.user_id == current_user.id || current_user.staff?

        before = mandate.status
        mandate.revoke!(by: current_user)
        AuditLog.record!(event_type: "MANDATE_REVOKED", entity_type: "AgentMandate", entity_id: mandate.id, actor: current_user,
                         description: "#{current_user.email} revoked the mandate of agent #{mandate.label}",
                         before: { status: before }, after: { status: mandate.status })
        render_success(payload(mandate), "Mandate revoked")
      rescue ActiveRecord::RecordNotFound
        render_error("Mandate not found", :not_found)
      end

      private

      def expiry_from_params
        days = params.fetch(:expires_in_days, 7).to_i
        days.clamp(1, AgentMandate::MAX_LIFETIME.in_days.to_i).days.from_now
      end

      def payload(mandate)
        {
          id: mandate.id, label: mandate.label, merchant: mandate.merchant, per_payment_cap: mandate.per_payment_cap.to_s,
          total_cap: mandate.total_cap.to_s, spent_amount: mandate.spent_amount.to_s, remaining: mandate.remaining.to_s,
          status: mandate.status, expires_at: mandate.expires_at, revoked_at: mandate.revoked_at, last_used_at: mandate.last_used_at,
          token_hint: mandate.token_hint, owner_email: (mandate.user.email if current_user.staff?)
        }
      end
    end
  end
end
