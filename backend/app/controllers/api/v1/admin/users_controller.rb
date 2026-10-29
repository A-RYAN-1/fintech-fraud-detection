module Api
  module V1
    module Admin
      class UsersController < BaseController
        before_action :require_staff!, only: :index
        before_action :require_admin!, only: [ :update_status, :update_role, :update_limit ]
        before_action :set_user, only: [ :update_status, :update_role, :update_limit ]
        before_action :limit_sandbox_admin!, only: [ :update_status, :update_role, :update_limit ]

        # GET /api/v1/admin/users?page=1&per_page=10&role=customer&status=active&search=jane
        def index
          users = User.order(created_at: :desc, id: :desc)

          if params[:role].present?
            return render_error("Invalid role", :unprocessable_entity) unless User.roles.key?(params[:role])

            users = users.where(role: params[:role])
          end

          if params[:status].present?
            return render_error("Invalid status", :unprocessable_entity) unless User.statuses.key?(params[:status])

            users = users.where(status: params[:status])
          end

          if params[:search].present?
            term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip)}%"
            users = users.where("email ILIKE :term OR first_name ILIKE :term OR last_name ILIKE :term", term: term)
          end

          records, pagination = paginate(users)
          render_success({ users: records.map { |u| serialize_user(u) }, pagination: pagination })
        end

        # PATCH /api/v1/admin/users/:id/status
        def update_status
          change_attribute(:status, User.statuses)
        end

        # PATCH /api/v1/admin/users/:id/role
        def update_role
          change_attribute(:role, User.roles)
        end

        # PATCH /api/v1/admin/users/:id/limit  { decision_limit: 500 }  the most a reviewer may decide alone (blank resets to the default)
        def update_limit
          return render_error("Only a reviewer has a decision limit", :unprocessable_entity) unless @user.reviewer?

          raw = params[:decision_limit].to_s.strip
          new_limit = raw.blank? ? nil : BigDecimal(raw, exception: false)
          return render_error("Limit must be a number of 0 or more", :unprocessable_entity) if raw.present? && (new_limit.nil? || new_limit.negative?)

          old_limit = @user.effective_decision_limit
          ActiveRecord::Base.transaction do
            @user.update!(decision_limit: new_limit)
            AuditLog.record!(event_type: "USER_DECISION_LIMIT_CHANGED", entity_type: "User", entity_id: @user.id,
                             description: "#{current_user.email} changed decision limit of #{@user.email} from #{old_limit.to_s('F')} to #{@user.effective_decision_limit.to_s('F')}",
                             actor: current_user, before: { decision_limit: old_limit.to_s("F") }, after: { decision_limit: @user.effective_decision_limit.to_s("F") })
          end
          render_success(serialize_user(@user), "Decision limit updated")
        end

        private

        def set_user
          @user = User.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("User not found", :not_found)
        end

        # The public sandbox admin may run the demo but not take it over: no change to an admin (itself included),
        # to a shared demo login, and nobody becomes an admin through it.
        def limit_sandbox_admin!
          return unless current_user.sandbox_admin?

          reason =
            if @user.admin? then "cannot change an admin"
            elsif @user.demo_account? then "cannot change a shared demo account"
            elsif params[:role].to_s == "admin" then "cannot make anyone an admin"
            end
          render_error("The sandbox admin #{reason}", :forbidden, "sandbox_admin") if reason
        end

        # Changes one enum attribute and records who did it, in one transaction.
        # An admin cannot change their own role or status, so the last admin cannot lock everyone out.
        def change_attribute(attribute, allowed)
          return render_error("You cannot change your own #{attribute}", :unprocessable_entity) if @user == current_user

          new_value = params[attribute].to_s
          return render_error("Invalid #{attribute}", :unprocessable_entity) unless allowed.key?(new_value)

          old_value = @user.public_send(attribute)
          unless old_value == new_value
            ActiveRecord::Base.transaction do
              @user.update!(attribute => new_value)
              AuditLog.record!(
                event_type: "USER_#{attribute.to_s.upcase}_CHANGED",
                entity_type: "User",
                entity_id: @user.id,
                description: "#{current_user.email} changed #{attribute} of #{@user.email} from #{old_value} to #{new_value}",
                actor: current_user, before: { attribute => old_value }, after: { attribute => new_value }
              )
            end
          end

          render_success(serialize_user(@user), "User #{attribute} updated")
        end

        def serialize_user(user)
          {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            status: user.status,
            decision_limit: user.effective_decision_limit&.to_f,
            created_at: user.created_at
          }
        end
      end
    end
  end
end
