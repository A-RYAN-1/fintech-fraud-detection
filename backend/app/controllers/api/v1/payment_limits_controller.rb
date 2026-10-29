module Api
  module V1
    # The admin-set auto-capture limits, readable by any signed-in user so the Pay form can say when a payment will be held.
    class PaymentLimitsController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/payment_limits
      def show
        render_success({
          max_auto_capture_amount: RiskRuleConfig.get(:max_auto_capture_amount).to_f,
          daily_auto_capture_cap: RiskRuleConfig.get(:daily_auto_capture_cap).to_f
        })
      end
    end
  end
end
