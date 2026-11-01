module Api
  module V1
    # The agent's side: it signs in with the mandate token, not a session. `current_user` is the mandate's owner, so
    # idempotency keys, audit rows and the payment itself belong to the person who gave the permission.
    class AgentPaymentsController < ApplicationController
      include Idempotent

      before_action :authenticate_mandate!
      idempotent :create

      MAX_AMOUNT = 10_000

      # POST /api/v1/agent/payments
      def create
        amount = BigDecimal(params.require(:amount).to_s, exception: false)
        unless amount && amount.positive? && amount <= MAX_AMOUNT
          return render_error("Amount must be between 0.01 and #{MAX_AMOUNT}", :unprocessable_entity)
        end

        result = AgentPayment.new(mandate: @mandate).call(
          amount: amount, merchant: params.require(:merchant).to_s, purpose: params[:purpose].to_s.first(200).presence,
          device_id: params[:device_id].to_s.first(255).presence || "agent-#{@mandate.id}", ip_address: request.remote_ip
        )
        render_success(payload(result), "Agent payment #{result.decision}", :created)
      rescue AgentMandate::Refused => e
        render_error(e.message, :forbidden, e.code)
      rescue ActiveRecord::RecordInvalid => e
        render_error("Payment could not be created", :unprocessable_entity, e.record.errors.full_messages)
      end

      # GET /api/v1/agent/mandate - what the agent may still do.
      def show
        render_success(mandate_payload(@mandate))
      end

      def current_user
        @mandate&.user
      end

      private

      def authenticate_mandate!
        @mandate = AgentMandate.find_by_token(bearer_token)
        return render_error("A valid mandate token is required", :unauthorized, "invalid_token") unless @mandate

        render_error("The mandate owner's account is suspended", :forbidden, "owner_suspended") unless @mandate.user.active?
      end

      def bearer_token
        request.headers["Authorization"].to_s[/\ABearer (\S+)\z/, 1] || request.headers["X-Mandate-Token"].to_s.strip
      end

      def mandate_payload(mandate)
        {
          label: mandate.label, merchant: mandate.merchant, per_payment_cap: mandate.per_payment_cap.to_s,
          remaining: mandate.remaining.to_s, status: mandate.status, expires_at: mandate.expires_at
        }
      end

      def payload(result)
        transaction = result.transaction
        {
          transaction_id: transaction.id, decision: result.decision, status: transaction.status, risk_score: transaction.risk_score,
          action_reason: transaction.paypal_action_reason, rules_triggered: transaction.fraud_evaluation&.rules_triggered || "",
          ai_verdict: transaction.fraud_evaluation&.ai_verdict, simulated: true, mandate: mandate_payload(result.mandate)
        }
      end
    end
  end
end
