module Api
  module V1
    # GET /api/v1/home  the signed-in person's Home numbers (HomeSummary).
    class HomeController < ApplicationController
      before_action :authenticate_user!

      def show
        render_success(HomeSummary.new(current_user).to_h)
      end
    end
  end
end
