module Api
  module V1
    module Admin
      class BaseController < ApplicationController
        before_action :authenticate_user!

        DEFAULT_PAGE = 1
        DEFAULT_PER_PAGE = 10
        MAX_PER_PAGE = 100

        private

        def require_staff!
          return if current_user.admin? || current_user.manager?

          render_error("Not authorized", :forbidden, "pundit_unauthorized")
        end

        def require_admin!
          return if current_user.admin?

          render_error("Not authorized", :forbidden, "pundit_unauthorized")
        end

        def paginate(scope)
          page = [ (params[:page] || DEFAULT_PAGE).to_i, 1 ].max
          per_page = (params[:per_page] || DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)
          total_count = scope.count

          records = scope.offset((page - 1) * per_page).limit(per_page)
          meta = {
            current_page: page,
            total_pages: (total_count.to_f / per_page).ceil,
            total_count: total_count
          }
          [ records, meta ]
        end
      end
    end
  end
end
