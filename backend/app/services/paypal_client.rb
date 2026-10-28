require "net/http"
require "json"
require "securerandom"

# Thin client for the PayPal REST API (Orders v2 and Payments v2). Configured only from the environment:
#   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL (defaults to the sandbox).
# There is no live default: pointing it at live money needs an explicit PAYPAL_BASE_URL.
class PaypalClient
  SANDBOX_URL = "https://api-m.sandbox.paypal.com".freeze

  class Error < StandardError
    INSUFFICIENT_FUNDS_ISSUES = %w[INSUFFICIENT_FUNDS REFUND_FAILED_INSUFFICIENT_FUNDS INSUFFICIENT_MERCHANT_FUNDS].freeze

    attr_reader :status, :debug_id, :issue

    def initialize(message, status: nil, debug_id: nil, issue: nil)
      super(message)
      @status = status
      @debug_id = debug_id
      @issue = issue
    end

    # PayPal refused a refund because the merchant balance cannot cover it.
    def insufficient_funds? = INSUFFICIENT_FUNDS_ISSUES.include?(issue)
  end

  class NotConfigured < Error; end

  def self.configured?
    ENV["PAYPAL_CLIENT_ID"].present? && ENV["PAYPAL_CLIENT_SECRET"].present?
  end

  def initialize(client_id: ENV["PAYPAL_CLIENT_ID"], secret: ENV["PAYPAL_CLIENT_SECRET"], base_url: ENV.fetch("PAYPAL_BASE_URL", SANDBOX_URL))
    raise NotConfigured, "PayPal is not configured" if client_id.blank? || secret.blank?

    @client_id = client_id
    @secret = secret
    @base_url = base_url
  end

  # Order that is authorized (funds held) when the buyer approves, not captured.
  def create_order(amount:, currency:, reference:, request_id: SecureRandom.uuid)
    post("/v2/checkout/orders", {
      intent: "AUTHORIZE",
      purchase_units: [ { reference_id: reference, custom_id: reference, amount: { currency_code: currency, value: format("%.2f", amount) } } ]
    }, request_id: request_id)
  end

  # Returns the authorization id of the first purchase unit.
  def authorize_order(order_id, request_id: SecureRandom.uuid)
    body = post("/v2/checkout/orders/#{escape(order_id)}/authorize", {}, request_id: request_id)
    authorization = body.dig("purchase_units", 0, "payments", "authorizations", 0)
    raise Error.new("PayPal returned no authorization", debug_id: body["debug_id"]) unless authorization

    authorization
  end

  def capture(authorization_id, request_id: SecureRandom.uuid)
    post("/v2/payments/authorizations/#{escape(authorization_id)}/capture", { final_capture: true }, request_id: request_id)
  end

  def void(authorization_id, request_id: SecureRandom.uuid)
    post("/v2/payments/authorizations/#{escape(authorization_id)}/void", nil, request_id: request_id)
  end

  # Without an amount PayPal refunds what is left of the capture; with one it refunds that part.
  def refund(capture_id, request_id: SecureRandom.uuid, amount: nil, currency: "USD")
    body = amount ? { amount: { currency_code: currency, value: format("%.2f", amount) } } : {}
    post("/v2/payments/captures/#{escape(capture_id)}/refund", body, request_id: request_id)
  end

  private

  def escape(id)
    ERB::Util.url_encode(id.to_s)
  end

  def access_token
    return @token if @token && @token_expires_at > Time.current + 30

    uri = URI("#{@base_url}/v1/oauth2/token")
    req = Net::HTTP::Post.new(uri)
    req.basic_auth(@client_id, @secret)
    req["Content-Type"] = "application/x-www-form-urlencoded"
    req.body = "grant_type=client_credentials"
    body = parse(send_request(uri, req))
    @token = body.fetch("access_token")
    @token_expires_at = Time.current + body.fetch("expires_in", 300).to_i
    @token
  end

  def post(path, payload, request_id:)
    uri = URI("#{@base_url}#{path}")
    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = "Bearer #{access_token}"
    req["Content-Type"] = "application/json"
    req["PayPal-Request-Id"] = request_id
    req["Prefer"] = "return=representation"
    req.body = payload.to_json unless payload.nil?
    parse(send_request(uri, req))
  end

  def send_request(uri, req)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 15) { |http| http.request(req) }
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError => e
    raise Error, "PayPal request failed: #{e.class}"
  end

  def parse(response)
    body = response.body.to_s.empty? ? {} : JSON.parse(response.body)
    return body if response.is_a?(Net::HTTPSuccess)

    issue = body["details"]&.first&.dig("issue") || body["name"]
    raise Error.new(body["message"] || "PayPal returned #{response.code}", status: response.code.to_i, debug_id: body["debug_id"], issue: issue)
  rescue JSON::ParserError
    raise Error.new("PayPal returned an unreadable response", status: response.code.to_i)
  end
end
