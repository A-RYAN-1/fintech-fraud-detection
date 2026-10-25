module Api
  module V1
    class PaypalOrdersController < ApplicationController
      before_action :authenticate_user!
      before_action :require_paypal

      MAX_AMOUNT = 10_000

      # POST /api/v1/paypal/orders
      # The amount is validated here, never taken from PayPal's side, so the buyer cannot change it in the popup.
      def create
        amount = BigDecimal(params.require(:amount).to_s, exception: false)
        return render_error("Amount must be between 0.01 and #{MAX_AMOUNT}", :unprocessable_entity) unless amount && amount.positive? && amount <= MAX_AMOUNT

        transaction = checkout.create_order(amount: amount, device_id: params.require(:device_id).to_s.first(255), ip_address: request.remote_ip)
        render_success({ order_id: transaction.paypal_order_id, transaction_id: transaction.id }, "PayPal order created", :created)
      rescue ActiveRecord::RecordInvalid => e
        render_error("Order could not be created", :unprocessable_entity, e.record.errors.full_messages)
      rescue PaypalClient::Error => e
        paypal_failed(e)
      end

      # POST /api/v1/paypal/orders/:order_id/authorize
      # Called after the buyer approved the order in the PayPal popup: authorize, score, then capture, hold or void.
      def authorize
        result = checkout.settle(params[:order_id])
        transaction = result.transaction
        render_success({
          transaction_id: transaction.id,
          decision: result.decision,
          status: transaction.status,
          risk_score: transaction.risk_score,
          paypal_status: transaction.paypal_status,
          action_reason: transaction.paypal_action_reason,
          rules_triggered: transaction.fraud_evaluation&.rules_triggered || "",
          ml_explanation: transaction.fraud_evaluation&.ml_explanation || [],
          ai_verdict: transaction.fraud_evaluation&.ai_verdict
        }, "Payment #{result.decision}")
      rescue ActiveRecord::RecordNotFound
        render_error("Order not found", :not_found)
      rescue PaypalClient::Error => e
        paypal_failed(e)
      end

      private

      def checkout
        @checkout ||= PaypalCheckout.new(user: current_user, client: paypal_client)
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
