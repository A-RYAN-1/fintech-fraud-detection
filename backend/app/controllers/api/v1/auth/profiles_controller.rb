module Api
  module V1
    module Auth
      # The signed-in person's own account: name, password and what they did lately. The shared demo logins are
      # read-only, so one visitor cannot lock the next one out.
      class ProfilesController < ApplicationController
        ACTIVITY_LIMIT = 10

        before_action :authenticate_user!
        before_action :refuse_demo_account!, only: [ :update, :password ]

        # PATCH /api/v1/auth/me  { first_name: "...", last_name: "..." }
        def update
          before = { first_name: current_user.first_name, last_name: current_user.last_name }
          current_user.assign_attributes(params.permit(:first_name, :last_name).to_h.transform_values { |v| v.to_s.strip })
          return render_error(current_user.errors.full_messages.to_sentence, :unprocessable_entity) unless current_user.valid?

          if current_user.changed?
            ActiveRecord::Base.transaction do
              current_user.save!
              AuditLog.record!(event_type: "USER_PROFILE_CHANGED", entity_type: "User", entity_id: current_user.id,
                               description: "#{current_user.email} changed their name",
                               actor: current_user, before: before,
                               after: { first_name: current_user.first_name, last_name: current_user.last_name })
            end
          end
          render_success(self.class.serialize(current_user), "Profile updated")
        end

        # PATCH /api/v1/auth/password  { current_password:, password:, password_confirmation: }
        def password
          unless current_user.authenticate(params[:current_password].to_s)
            return render_error("Current password is wrong", :unprocessable_entity)
          end

          current_user.assign_attributes(password: params[:password].to_s,
                                         password_confirmation: params[:password_confirmation].to_s)
          return render_error(current_user.errors.full_messages.to_sentence, :unprocessable_entity) unless current_user.valid?

          ActiveRecord::Base.transaction do
            current_user.save!
            AuditLog.record!(event_type: "USER_PASSWORD_CHANGED", entity_type: "User", entity_id: current_user.id,
                             description: "#{current_user.email} changed their password", actor: current_user)
          end
          render_success(nil, "Password changed")
        end

        # GET /api/v1/auth/activity  the newest audit rows this person caused
        def activity
          logs = AuditLog.where(actor: current_user).order(created_at: :desc, id: :desc).limit(ACTIVITY_LIMIT)
          render_success({
            activity: logs.map { |log| { id: log.id, event_type: log.event_type, description: log.description, created_at: log.created_at } }
          })
        end

        def self.serialize(user)
          {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            status: user.status,
            decision_limit: user.effective_decision_limit&.to_f,
            created_at: user.created_at,
            demo_account: user.demo_account?
          }
        end

        private

        def refuse_demo_account!
          return unless current_user.demo_account?

          render_error("Demo accounts are shared by everyone who tries Sentrix, so they are read-only", :forbidden, "demo_account")
        end
      end
    end
  end
end
