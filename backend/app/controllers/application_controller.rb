class ApplicationController < ActionController::API
  include Pundit::Authorization

  # Include cookies for session management
  include ActionController::Cookies

  SESSION_TIMEOUT = 10.minutes

  before_action :check_session_timeout

  rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized

  def current_user
    @current_user ||= User.find_by(id: session[:user_id]) if session[:user_id]
  end

  def authenticate_user!
    return render_error("Authentication required", :unauthorized) unless current_user
    return if current_user.active?

    # An admin can suspend an account that already has a session; its next request ends it.
    reset_session
    @current_user = nil
    render_error("Account is suspended", :forbidden)
  end

  # The signed-in user's id goes on the request log line (see lib/structured_logging.rb).
  def append_info_to_payload(payload)
    super
    payload[:user_id] = session[:user_id]
  end

  protected

  def render_success(data, message = "Success", status = :ok)
    render json: {
      status: "success",
      message: message,
      data: data,
      error: nil
    }, status: status
  end

  def render_error(message, status = :bad_request, error = nil)
    render json: {
      status: "error",
      message: message,
      data: nil,
      error: error || status
    }, status: status
  end

  private

  def check_session_timeout
    if session[:user_id] && session[:last_activity_at]
      if Time.parse(session[:last_activity_at]) < SESSION_TIMEOUT.ago
        reset_session
        render_error("Session expired. Please login again.", :unauthorized, "session_expired")
      else
        session[:last_activity_at] = Time.current.iso8601
      end
    elsif session[:user_id]
      # Initialize timeout for existing sessions that don't have it yet
      session[:last_activity_at] = Time.current.iso8601
    end
  end

  def user_not_authorized
    render_error("Not authorized", :forbidden, "pundit_unauthorized")
  end
end
