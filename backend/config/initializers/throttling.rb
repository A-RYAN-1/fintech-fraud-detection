# Rate limits, checked before a request reaches a controller.
#
# This file is named to load after session_store.rb: the limiter has to sit behind the session
# store to read the signed-in user. The gem adds itself ahead of it, so it is moved below.
#
# Counters live in this process's memory: the API runs as one process on the free Render
# plan, so one store is the whole picture. With more than one instance each would count
# separately; the limit would then be per instance (move the store to Redis or solid_cache).
class Rack::Attack
  LIMITS = {
    general: { limit: 300, period: 5.minutes },
    login_ip: { limit: 5, period: 1.minute },
    login_email: { limit: 5, period: 1.minute },
    register_ip: { limit: 10, period: 1.hour },
    payment: { limit: 10, period: 1.minute },
    scoring: { limit: 20, period: 1.minute },
    admin_action: { limit: 30, period: 1.minute }
  }.freeze

  PAYMENT_PATH = %r{\A/api/v1/paypal/orders(/[^/]+/authorize)?\z}
  ADMIN_ACTION_PATH = %r{\A/api/v1/admin/review_queue/[^/]+/(approve|void|refund)\z}

  self.cache.store = ActiveSupport::Cache::MemoryStore.new(size: 4.megabytes)

  # The signed-in user when the session is readable here, otherwise the client address.
  def self.actor(req)
    user_id = req.env["rack.session"]&.[]("user_id")
    user_id ? "user:#{user_id}" : "ip:#{req.ip}"
  end

  def self.throttle_rule(name)
    rule = LIMITS.fetch(name)
    throttle(name.to_s, limit: rule[:limit], period: rule[:period]) { |req| yield(req) }
  end

  throttle_rule(:general) { |req| req.ip unless req.path == "/up" }

  throttle_rule(:login_ip) { |req| req.ip if req.post? && req.path == "/api/v1/auth/login" }
  throttle_rule(:login_email) do |req|
    next unless req.post? && req.path == "/api/v1/auth/login"
    email = req.params["email"].to_s.strip.downcase
    email.presence
  end
  throttle_rule(:register_ip) { |req| req.ip if req.post? && req.path == "/api/v1/auth/register" }

  throttle_rule(:payment) { |req| actor(req) if req.post? && req.path.match?(PAYMENT_PATH) }
  throttle_rule(:scoring) { |req| actor(req) if req.post? && req.path == "/api/v1/transactions" }
  throttle_rule(:admin_action) { |req| actor(req) if req.post? && req.path.match?(ADMIN_ACTION_PATH) }

  self.throttled_responder = lambda do |req|
    match = req.env["rack.attack.match_data"] || {}
    retry_after = [ match[:period].to_i - (match[:epoch_time].to_i % [ match[:period].to_i, 1 ].max), 1 ].max
    body = {
      status: "error",
      message: "Too many requests. Try again in #{retry_after} seconds.",
      data: nil,
      error: "rate_limited"
    }.to_json
    [ 429, { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s }, [ body ] ]
  end
end

# Tests turn it on only where they check a limit, so the rest of the suite is not throttled.
Rack::Attack.enabled = false if Rails.env.test?

Rails.application.config.middleware.move_after ActionDispatch::Session::CookieStore, Rack::Attack
