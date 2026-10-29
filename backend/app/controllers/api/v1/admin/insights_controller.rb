module Api
  module V1
    module Admin
      # GET /api/v1/admin/insights?period=7d|30d|90d  staff-wide numbers over every PayPal payment (InsightsReport).
      class InsightsController < BaseController
        before_action :require_staff!

        def show
          period = params[:period].presence || "7d"
          return render_error("Period must be one of #{InsightsReport::PERIODS.keys.join(', ')}", :unprocessable_entity) unless InsightsReport::PERIODS.key?(period)

          render_success(InsightsReport.new(period: period).to_h)
        end
      end
    end
  end
end
