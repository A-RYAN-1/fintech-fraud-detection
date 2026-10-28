module Api
  module V1
    module Admin
      # Whether the AI analyst is being used: configured, the circuit breaker state, the token bucket and the counters.
      class AnalystStatusController < BaseController
        before_action :require_staff!

        # GET /api/v1/admin/analyst_status
        def show
          render_success({ enabled: AiAnalyst.enabled?, model: ENV.fetch("GEMINI_MODEL", GeminiClient::DEFAULT_MODEL), **AnalystGuard.instance.snapshot })
        end
      end
    end
  end
end
