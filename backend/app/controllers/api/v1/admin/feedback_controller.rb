module Api
  module V1
    module Admin
      # The feedback loop: how often each automatic signal agrees with the human decision, over time, and the payments
      # where they disagreed.
      class FeedbackController < BaseController
        before_action :require_staff!

        # GET /api/v1/admin/feedback?signal=rules|ml|ai&page=1
        def show
          signal = params[:signal].presence
          return render_error("Invalid signal", :unprocessable_entity) if signal && !FeedbackReport::SIGNALS.include?(signal)

          report = FeedbackReport.new
          records, meta = paginate_array(report.disagreements(signal: signal))
          render_success(report.summary.merge(disagreements: records, meta: meta))
        end

        private

        def paginate_array(rows)
          page = [ (params[:page] || DEFAULT_PAGE).to_i, 1 ].max
          per_page = (params[:per_page] || DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)
          [ rows.slice((page - 1) * per_page, per_page) || [], { current_page: page, total_pages: (rows.size.to_f / per_page).ceil, total_count: rows.size } ]
        end
      end
    end
  end
end
