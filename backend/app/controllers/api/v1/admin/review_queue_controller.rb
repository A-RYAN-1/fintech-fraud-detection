module Api
  module V1
    module Admin
      # The human side of the agent: payments the agent held (rules, model or AI sent them to review, or they broke a
      # limit), with everything the reviewer needs, and the override actions. Every action is audited with who, their role, before and after, and the reason.
      # Analysts view, note and propose; reviewers decide up to their limit; admins decide anything.
      class ReviewQueueController < BaseController
        include Idempotent

        before_action :require_staff!, only: [ :index, :note, :propose ]
        before_action :require_decider!, only: [ :approve, :void, :refund ]
        idempotent :approve, :void, :refund

        MAX_NOTE = 200
        PROPOSABLE = %w[approve void refund].freeze
        NOTE_EVENTS = %w[REVIEW_NOTE DECISION_PROPOSED].freeze

        # GET /api/v1/admin/review_queue            payments waiting for a decision
        # GET /api/v1/admin/review_queue?scope=captured   captured payments, where a refund can be requested
        def index
          statuses = params[:scope] == "captured" ? %w[CAPTURED PARTIALLY_REFUNDED] : %w[HELD]
          scope = Transaction.where(paypal_status: statuses).includes(:fraud_evaluation, :user)
          # `cursor=` (empty for the first page) pages by keyset, see Keyset; without it the numbered pages stay.
          records, meta = params.key?(:cursor) ? keyset_page(scope) : paginate(scope.order(created_at: :desc, id: :desc))
          notes = recent_notes(records.map { |t| t.id.to_s })
          @pending = ApprovalRequest.pending.where(payment_id: records.map(&:id)).includes(:requested_by).group_by(&:payment_id)
          render_success({ held: records.map { |t| serialize(t, notes[t.id.to_s] || []) }, meta: meta,
                           limit: current_user.effective_decision_limit&.to_f, role: current_user.role })
        end

        # POST /api/v1/admin/review_queue/:id/note  { note: "..." }  any staff member leaves a note on a payment
        def note
          leave("REVIEW_NOTE", "noted")
        end

        # POST /api/v1/admin/review_queue/:id/propose  { proposal: approve|void|refund, note: "..." }  an analyst's recommendation
        def propose
          return render_error("Proposal must be one of #{PROPOSABLE.join(', ')}", :unprocessable_entity) unless PROPOSABLE.include?(params[:proposal].to_s)

          leave("DECISION_PROPOSED", "proposed to #{params[:proposal]}")
        end

        # POST /api/v1/admin/review_queue/:id/approve  { note: "..." }  captures the held payment. Above the caller's
        # decision limit it becomes a request for an admin (202) and nothing moves.
        def approve
          return request_admin("approve") unless within_limit?

          act { |actions, transaction| actions.capture(transaction, actor: actor, reason: reason("Approved by a human")) }
        end

        # POST /api/v1/admin/review_queue/:id/void  { note: "..." }  releases the authorization, nothing is charged
        def void
          return request_admin("void") unless within_limit?

          act { |actions, transaction| actions.void(transaction, actor: actor, reason: reason("Voided by a human")) }
        end

        # POST /api/v1/admin/review_queue/:id/refund  { note: "...", amount: 12.50 }  asks for a refund, in full or in
        # part (amount). A refund needs two distinct people, so this raises a request (202) for a different admin to
        # settle; refunds add up and never pass the captured amount.
        def refund
          request_admin("refund", amount: params[:amount].presence)
        end

        private

        def within_limit?
          transaction = Transaction.find_by(id: params[:id])
          transaction.nil? || current_user.within_limit?(transaction.amount)
        end

        def request_admin(action, amount: nil)
          transaction = Transaction.find(params[:id])
          request = ApprovalWorkflow.new.request!(payment: transaction, action: action, requester: current_user, reason: params[:note], amount: amount)
          render json: { status: "success", message: "Sent to an admin for a decision", data: { approval_request: ApprovalRequestsController.serialize(request) } }, status: :accepted
        rescue ActiveRecord::RecordNotFound
          render_error("Transaction not found", :not_found)
        rescue PaypalActions::InvalidState => e
          render_error(e.message, :conflict)
        rescue PaypalActions::InvalidAmount, ArgumentError => e
          render_error(e.is_a?(ArgumentError) ? "Refund amount is not a number" : e.message, :unprocessable_entity)
        end

        def leave(event_type, verb)
          transaction = Transaction.find(params[:id])
          text = params[:note].to_s.squish.first(MAX_NOTE)
          return render_error("A note is required", :unprocessable_entity) if text.blank? && event_type == "REVIEW_NOTE"

          AuditLog.record!(event_type: event_type, entity_type: "Transaction", entity_id: transaction.id,
                           description: "#{current_user.email} #{verb}: #{text}".strip, actor: current_user, reason: text,
                           after: { proposal: params[:proposal].presence }.compact.presence)
          render_success(serialize(transaction, recent_notes([ transaction.id.to_s ])[transaction.id.to_s] || []), "Saved")
        rescue ActiveRecord::RecordNotFound
          render_error("Transaction not found", :not_found)
        end

        def recent_notes(ids)
          return {} if ids.empty?

          AuditLog.where(entity_type: "Transaction", entity_id: ids, event_type: NOTE_EVENTS).includes(:actor).order(created_at: :desc)
                  .group_by(&:entity_id).transform_values { |logs| logs.first(5).map { |l| serialize_note(l) } }
        end

        def pending_request_for(transaction)
          # The list preloads every pending request; a payment with none must not fall back to one query per row.
          request = @pending ? @pending[transaction.id]&.first : ApprovalRequest.pending.find_by(payment_id: transaction.id)
          request && ApprovalRequestsController.serialize(request)
        end

        def serialize_note(log)
          { event_type: log.event_type, actor: log.actor&.email, role: log.actor_role, text: log.reason,
            proposal: log.after_state&.dig("proposal"), created_at: log.created_at }
        end

        def act
          transaction = Transaction.find(params[:id])
          return render_error("PayPal is not configured", :service_unavailable) unless transaction.simulated? || PaypalClient.configured?

          client = transaction.simulated? ? SimulatedPaypalClient.new : paypal_client
          yield PaypalActions.new(client: client), transaction
          render_success(serialize(transaction.reload), "Payment #{transaction.paypal_status.downcase}")
        rescue ActiveRecord::RecordNotFound
          render_error("Transaction not found", :not_found)
        rescue PaypalActions::InvalidState, PaypalActions::InsufficientFunds => e
          render_error(e.message, :conflict)
        rescue PaypalActions::InvalidAmount, ArgumentError => e
          render_error(e.is_a?(ArgumentError) ? "Refund amount is not a number" : e.message, :unprocessable_entity)
        rescue PaypalClient::Error => e
          Rails.logger.error("PayPal error status=#{e.status} debug_id=#{e.debug_id} #{e.message}")
          render_error("PayPal request failed", :bad_gateway, e.debug_id)
        end

        def actor
          current_user
        end

        def reason(default)
          note = params[:note].to_s.squish.first(MAX_NOTE)
          note.present? ? "#{default}: #{note}" : default
        end

        # Tests replace this to avoid the network.
        def paypal_client
          PaypalClient.new
        end

        def serialize(transaction, notes = [])
          evaluation = transaction.fraud_evaluation
          {
            id: transaction.id,
            user_email: transaction.user.email,
            amount: transaction.amount.to_f,
            created_at: transaction.created_at,
            status: transaction.status,
            risk_score: transaction.risk_score,
            paypal_status: transaction.paypal_status,
            simulated: transaction.simulated?,
            authorization_expires_at: transaction.paypal_authorization_expires_at,
            refunded_amount: transaction.refunded_amount.to_f,
            capture_mode: transaction.paypal_capture_mode,
            action_reason: transaction.paypal_action_reason,
            rules_triggered: evaluation&.rules_triggered.to_s.split(","),
            ml_score: evaluation&.ml_score,
            ml_explanation: evaluation&.ml_explanation || [],
            ai_verdict: evaluation&.ai_verdict,
            pending_request: pending_request_for(transaction),
            notes: notes
          }
        end
      end
    end
  end
end
