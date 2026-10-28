module Api
  module V1
    module Admin
      # The human side of the agent: payments the agent held (rules, model or AI sent them to review, or they broke a
      # limit), with everything the reviewer needs, and the override actions. Every action is audited with the admin's email.
      class ReviewQueueController < BaseController
        include Idempotent

        before_action :require_staff!, only: :index
        before_action :require_admin!, only: [ :approve, :void, :refund ]
        idempotent :approve, :void, :refund
        
        MAX_NOTE = 200

        # GET /api/v1/admin/review_queue
        def index
          scope = Transaction.where(paypal_status: "HELD").includes(:fraud_evaluation, :user).order(created_at: :desc)
          records, meta = paginate(scope)
          render_success({ held: records.map { |t| serialize(t) }, meta: meta })
        end

        # POST /api/v1/admin/review_queue/:id/approve  { note: "..." }  captures the held payment
        def approve
          act { |actions, transaction| actions.capture(transaction, actor: actor, reason: reason("Approved by a human")) }
        end

        # POST /api/v1/admin/review_queue/:id/void  { note: "..." }  releases the authorization, nothing is charged
        def void
          act { |actions, transaction| actions.void(transaction, actor: actor, reason: reason("Voided by a human")) }
        end

        # POST /api/v1/admin/review_queue/:id/refund  { note: "..." }  returns a captured payment
        def refund
          act { |actions, transaction| actions.refund(transaction, actor: actor, reason: reason("Refunded by a human")) }
        end

        private

        def act
          transaction = Transaction.find(params[:id])
          return render_error("PayPal is not configured", :service_unavailable) unless transaction.simulated? || PaypalClient.configured?

          client = transaction.simulated? ? SimulatedPaypalClient.new : paypal_client
          yield PaypalActions.new(client: client), transaction
          render_success(serialize(transaction.reload), "Payment #{transaction.paypal_status.downcase}")
        rescue ActiveRecord::RecordNotFound
          render_error("Transaction not found", :not_found)
        rescue PaypalActions::InvalidState => e
          render_error(e.message, :conflict)
        rescue PaypalClient::Error => e
          Rails.logger.error("PayPal error status=#{e.status} debug_id=#{e.debug_id} #{e.message}")
          render_error("PayPal request failed", :bad_gateway, e.debug_id)
        end

        def actor
          current_user.email
        end

        def reason(default)
          note = params[:note].to_s.squish.first(MAX_NOTE)
          note.present? ? "#{default}: #{note}" : default
        end

        # Tests replace this to avoid the network.
        def paypal_client
          PaypalClient.new
        end

        def serialize(transaction)
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
            capture_mode: transaction.paypal_capture_mode,
            action_reason: transaction.paypal_action_reason,
            rules_triggered: evaluation&.rules_triggered.to_s.split(","),
            ml_score: evaluation&.ml_score,
            ml_explanation: evaluation&.ml_explanation || [],
            ai_verdict: evaluation&.ai_verdict
          }
        end
      end
    end
  end
end
