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
    general: { limit: 600, period: 5.minutes },
    login_ip: { limit: 20, period: 1.minute },
    login_email: { limit: 5, period: 1.minute },
    register_ip: { limit: 10, period: 1.hour },
    payment: { limit: 10, period: 1.minute },
    scoring: { limit: 20, period: 1.minute },
    admin_action: { limit: 30, period: 1.minute },
    support: { limit: 5, period: 1.hour }
  }.freeze

  PAYMENT_PATH = %r{\A/api/v1/paypal/orders(/[^/]+/authorize)?\z}
  SCORING_PATHS = %w[/api/v1/transactions /api/v1/payments/simulate].freeze
  ADMIN_ACTION_PATH = %r{\A/api/v1/admin/review_queue/[^/]+/(approve|void|refund)\z}

  self.cache.store = ActiveSupport::Cache::MemoryStore.new(size: 4.megabytes)

  # The client address as Rails resolves it (see trusted_proxies.rb). Browser traffic through the
  # Vercel proxy can share Vercel's egress address, so the per-address rules are the coarse ones
  # and the per-email and per-user rules are the precise ones.
  def self.client_ip(req)
    req.env["action_dispatch.remote_ip"]&.to_s || req.ip
  end

  # The signed-in user when the session is readable here, otherwise the client address.
  def self.actor(req)
    user_id = req.env["rack.session"]&.[]("user_id")
    user_id ? "user:#{user_id}" : "ip:#{client_ip(req)}"
  end

  def self.throttle_rule(name)
    rule = LIMITS.fetch(name)
    throttle(name.to_s, limit: rule[:limit], period: rule[:period]) { |req| yield(req) }
  end

  throttle_rule(:general) { |req| client_ip(req) unless req.path == "/up" }

  throttle_rule(:login_ip) { |req| client_ip(req) if req.post? && req.path == "/api/v1/auth/login" }
  throttle_rule(:login_email) do |req|
    next unless req.post? && req.path == "/api/v1/auth/login"
    email = req.params["email"].to_s.strip.downcase
    email.presence
  end
  throttle_rule(:register_ip) { |req| client_ip(req) if req.post? && req.path == "/api/v1/auth/register" }

  throttle_rule(:payment) { |req| actor(req) if req.post? && req.path.match?(PAYMENT_PATH) }
  throttle_rule(:scoring) { |req| actor(req) if req.post? && SCORING_PATHS.include?(req.path) }
  throttle_rule(:admin_action) { |req| actor(req) if req.post? && req.path.match?(ADMIN_ACTION_PATH) }
  throttle_rule(:support) { |req| actor(req) if req.post? && req.path == "/api/v1/support_messages" }

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

# For the local load test only (docs/performance.md): RATE_LIMITS=off measures the app itself instead of the limits,
# which allow about 2 requests a second from one address. Never set it on a deployed service; the boot log says so.
if ENV["RATE_LIMITS"] == "off"
  Rack::Attack.enabled = false
  Rails.logger.warn("RATE_LIMITS=off: rate limits are disabled (load test only)")
end

Rails.application.config.middleware.move_after ActionDispatch::Session::CookieStore, Rack::Attack
