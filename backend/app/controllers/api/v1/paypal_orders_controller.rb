module Api
  module V1
    class PaypalOrdersController < ApplicationController
      include Idempotent

      before_action :authenticate_user!
      before_action :require_paypal, except: :simulate
      idempotent :create, :simulate, :authorize

      MAX_AMOUNT = 10_000

      # POST /api/v1/paypal/orders
      # The amount is validated here, never taken from PayPal's side, so the buyer cannot change it in the popup.
      def create
        amount = valid_amount
        return unless amount

        transaction = checkout.create_order(amount: amount, device_id: params.require(:device_id).to_s.first(255), ip_address: request.remote_ip,
                                       request_id: paypal_request_id)
        render_success({ order_id: transaction.paypal_order_id, transaction_id: transaction.id }, "PayPal order created", :created)
      rescue ActiveRecord::RecordInvalid => e
        render_error("Order could not be created", :unprocessable_entity, e.record.errors.full_messages)
      rescue PaypalClient::Error => e
        paypal_failed(e)
      end

      # POST /api/v1/payments/simulate
      # A labelled test payment: the same pipeline as a PayPal payment (rules, model, AI analyst, admin limits, the
      # agent's capture, hold or void) with the PayPal calls replaced by SimulatedPaypalClient. No money moves.
      def simulate
        amount = valid_amount
        return unless amount

        simulated = PaypalCheckout.new(user: current_user, client: SimulatedPaypalClient.new)
        transaction = simulated.create_order(amount: amount, device_id: params.require(:device_id).to_s.first(255), ip_address: request.remote_ip)
        result = simulated.settle(transaction.paypal_order_id)
        render_success(settled_payload(result), "Simulated payment #{result.decision}", :created)
      rescue ActiveRecord::RecordInvalid => e
        render_error("Payment could not be simulated", :unprocessable_entity, e.record.errors.full_messages)
      end

      # POST /api/v1/paypal/orders/:order_id/authorize
      # Called after the buyer approved the order in the PayPal popup: authorize, score, then capture, hold or void.
      def authorize
        result = checkout.settle(params[:order_id])
        render_success(settled_payload(result), "Payment #{result.decision}")
      rescue ActiveRecord::RecordNotFound
        render_error("Order not found", :not_found)
      rescue PaypalClient::Error => e
        paypal_failed(e)
      end

      private

      # Renders the 422 itself and returns nil when the amount is out of range.
      def valid_amount
        amount = BigDecimal(params.require(:amount).to_s, exception: false)
        return amount if amount && amount.positive? && amount <= MAX_AMOUNT

        render_error("Amount must be between 0.01 and #{MAX_AMOUNT}", :unprocessable_entity)
        nil
      end

      def settled_payload(result)
        transaction = result.transaction
        {
          transaction_id: transaction.id,
          decision: result.decision,
          status: transaction.status,
          risk_score: transaction.risk_score,
          paypal_status: transaction.paypal_status,
          action_reason: transaction.paypal_action_reason,
          rules_triggered: transaction.fraud_evaluation&.rules_triggered || "",
          ml_explanation: transaction.fraud_evaluation&.ml_explanation || [],
          ai_verdict: transaction.fraud_evaluation&.ai_verdict,
          simulated: transaction.simulated?
        }
      end

      def checkout
        @checkout ||= PaypalCheckout.new(user: current_user, client: paypal_client)
      end

      # The client's Idempotency-Key becomes PayPal's PayPal-Request-Id, so even a retry that got past our own
      # replay (a crash between the PayPal call and the stored response) cannot create a second PayPal order.
      def paypal_request_id
        key = idempotency_key
        key ? Digest::SHA256.hexdigest("order:#{current_user.id}:#{key}") : SecureRandom.uuid
      end

      # Tests replace this to avoid the network.
      def paypal_client
        PaypalClient.new
      end

      def require_paypal
        render_error("PayPal is not configured", :service_unavailable) unless PaypalClient.configured?
      end

      def paypal_failed(error)
        Rails.logger.error("PayPal error status=#{error.status} debug_id=#{error.debug_id} #{error.message}")
        render_error("PayPal request failed", :bad_gateway, error.debug_id)
      end
    end
  end
end
