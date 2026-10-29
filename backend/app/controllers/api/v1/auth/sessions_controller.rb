module Api
  module V1
    module Auth
      class SessionsController < ApplicationController
        # POST /api/v1/auth/login
        def create
          user = User.find_by(email: params[:email]&.downcase)

          if user&.authenticate(params[:password])
            if user.active?
              session[:user_id] = user.id
              session[:last_activity_at] = Time.current.iso8601
              render_success(serialize_user(user), "Logged in successfully")
            else
              render_error("Account is #{user.status}", :forbidden)
            end
          else
            render_error("Invalid email or password", :unauthorized)
          end
        end

        # DELETE /api/v1/auth/logout
        def destroy
          session.delete(:user_id)
          @current_user = nil
          render_success(nil, "Logged out successfully")
        end

        # GET /api/v1/auth/me
        def show
          if current_user
            render_success(serialize_user(current_user))
          else
            render_error("Not authenticated", :unauthorized)
          end
        end

        private

        def serialize_user(user)
          ProfilesController.serialize(user)
        end
      end
    end
  end
end
