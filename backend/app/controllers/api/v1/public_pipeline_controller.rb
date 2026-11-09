module Api
  module V1
    # GET /api/v1/public/pipeline  the pipeline counts of the last 7 days for the public tour page.
    # No sign-in: counts only (no amounts, people, emails or ids), cached for a minute.
    class PublicPipelineController < ApplicationController
      CACHE_TTL = 1.minute

      def show
        counts = Rails.cache.fetch("public_pipeline", expires_in: CACHE_TTL) { HomeSummary.public_pipeline }
        render_success({ window_days: HomeSummary::WINDOW.in_days.to_i, pipeline: counts })
      end
    end
  end
end
