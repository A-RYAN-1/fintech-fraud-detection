module Api
  module V1
    module Admin
      class AuditLogsController < BaseController
        before_action :require_admin!

        # GET /api/v1/admin/audit_logs?page=1&per_page=10&event_type=USER_ROLE_CHANGED&entity_type=User
        def index
          logs = AuditLog.order(created_at: :desc, id: :desc)
          logs = logs.where(event_type: params[:event_type]) if params[:event_type].present?
          logs = logs.where(entity_type: params[:entity_type]) if params[:entity_type].present?

          records, pagination = paginate(logs)
          render_success({ audit_logs: records.map { |l| serialize_log(l) }, pagination: pagination })
        end

        private

        def serialize_log(log)
          {
            id: log.id,
            event_type: log.event_type,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            description: log.description,
            created_at: log.created_at
          }
        end
      end
    end
  end
end
