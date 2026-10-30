module Api
  module V1
    module Admin
      # Requests an admin settles: an approve or void above someone's limit, and every refund. A different admin than
      # the requester settles it; the money moves only on approve.
      class ApprovalRequestsController < BaseController
        include Idempotent

        before_action :require_staff!, only: :index
        before_action :require_admin!, only: [ :approve, :reject ]
        idempotent :approve, :reject

        # GET /api/v1/admin/approval_requests?status=pending|approved|rejected|all
        def index
          status = params[:status].presence || "pending"
          return render_error("Invalid status", :unprocessable_entity) unless status == "all" || ApprovalRequest.statuses.key?(status)

          scope = ApprovalRequest.includes(:payment, :requested_by, :decided_by).order(created_at: :desc, id: :desc)
          scope = scope.where(status: status) unless status == "all"
          records, meta = paginate(scope)
          render_success({ approval_requests: records.map { |r| self.class.serialize(r) }, meta: meta })
        end

        # POST /api/v1/admin/approval_requests/:id/approve  { note: "..." }
        def approve
          settle { |workflow, request| workflow.approve!(request, admin: current_user, note: params[:note]) }
        end

        # POST /api/v1/admin/approval_requests/:id/reject  { note: "..." }
        def reject
          settle(needs_paypal: false) { |workflow, request| workflow.reject!(request, admin: current_user, note: params[:note]) }
        end

        def self.serialize(request)
          payment = request.payment
          {
            id: request.id,
            transaction_id: request.payment_id,
            action: request.action,
            amount: request.amount&.to_f,
            reason: request.reason,
            status: request.status,
            requested_by: request.requested_by.email,
            decided_by: request.decided_by&.email,
            decided_at: request.decided_at,
            decision_note: request.decision_note,
            created_at: request.created_at,
            payment: { amount: payment.amount.to_f, user_email: payment.user.email, paypal_status: payment.paypal_status, simulated: payment.simulated? }
          }
        end

        private

        def settle(needs_paypal: true)
          request = ApprovalRequest.find(params[:id])
          if !needs_paypal || request.payment.simulated? || PaypalClient.configured?
            yield ApprovalWorkflow.new(client: (paypal_client_for(request) if needs_paypal)), request
            render_success(self.class.serialize(request.reload), "Request #{request.status}")
          else
            render_error("PayPal is not configured", :service_unavailable)
          end
        rescue ActiveRecord::RecordNotFound
          render_error("Request not found", :not_found)
        rescue ApprovalWorkflow::SelfApproval => e
          render_error(e.message, :forbidden, "self_approval")
        rescue ApprovalWorkflow::NotPending, PaypalActions::InvalidState, PaypalActions::InsufficientFunds => e
          render_error(e.message, :conflict)
        rescue PaypalActions::InvalidAmount => e
          render_error(e.message, :unprocessable_entity)
        rescue PaypalClient::Error => e
          IncidentLog.paypal_error(e, action: "settle_approval", payment_id: request&.payment_id)
          Rails.logger.error("PayPal error status=#{e.status} debug_id=#{e.debug_id} #{e.message}")
          render_error("PayPal request failed", :bad_gateway, e.debug_id)
        end

        # Tests replace this to avoid the network.
        def paypal_client_for(request)
          request.payment.simulated? ? SimulatedPaypalClient.new : PaypalClient.new
        end
      end
    end
  end
end
