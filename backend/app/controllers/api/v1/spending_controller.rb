module Api
  module V1
    # GET /api/v1/spending?period=7d|30d|90d  the signed-in customer's own money (SpendingReport).
    class SpendingController < ApplicationController
      before_action :authenticate_user!

      def show
        return render_error("My Spending is for customers", :forbidden) unless current_user.customer?

        period = params[:period].presence || "30d"
        return render_error("Period must be one of #{SpendingReport::PERIODS.keys.join(', ')}", :unprocessable_entity) unless SpendingReport::PERIODS.key?(period)

        render_success(AnalyticsCache.fetch("spending", current_user.id, period) { SpendingReport.new(current_user, period: period).to_h })
      end
    end
  end
end
