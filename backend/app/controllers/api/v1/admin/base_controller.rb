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
          return if current_user.staff?

          render_error("Not authorized", :forbidden, "pundit_unauthorized")
        end

        # Admin or reviewer: the roles that may approve, void or refund. Analysts only view, note and propose.
        def require_decider!
          return if current_user.can_decide?

          render_error("Not authorized", :forbidden, "pundit_unauthorized")
        end

        def require_admin!
          return if current_user.admin?

          render_error("Not authorized", :forbidden, "pundit_unauthorized")
        end

        # Newest first by keyset (lib/keyset.rb); meta carries next_cursor, which is nil on the last page.
        def keyset_page(scope)
          per_page = (params[:per_page] || DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)
          records, next_cursor = Keyset.page(scope, cursor: params[:cursor], limit: per_page)
          [ records, { total_count: scope.count, per_page: per_page, next_cursor: next_cursor, has_more: next_cursor.present? } ]
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
