require "net/http"
require "json"

# Thin client for the Gemini generateContent API with a JSON response schema. Configured only from the
# environment: GEMINI_API_KEY, GEMINI_MODEL (default below). The model is pinned here because Google retires
# models for new keys without notice (gemini-2.5-flash already answers 404 to keys created after its cutoff),
# and the preview models are throttled to a handful of calls a minute on the free tier.
class GeminiClient
  BASE_URL = "https://generativelanguage.googleapis.com/v1beta".freeze
  DEFAULT_MODEL = "gemini-3.1-flash-lite".freeze

  class Error < StandardError
    RETRYABLE_STATUSES = [ 429, 500, 502, 503, 504 ].freeze

    attr_reader :status, :retry_after

    def initialize(message, status: nil, retry_after: nil)
      super(message)
      @status = status
      @retry_after = retry_after
    end

    # A quick HTTP refusal that may pass on a second try. A timeout is not retried: the time is already spent.
    def retryable? = RETRYABLE_STATUSES.include?(status)
  end

  def self.configured?
    ENV["GEMINI_API_KEY"].present?
  end

  attr_reader :model

  def initialize(api_key: ENV["GEMINI_API_KEY"], model: ENV.fetch("GEMINI_MODEL", DEFAULT_MODEL), timeout: 8)
    raise Error, "Gemini is not configured" if api_key.blank?

    @api_key = api_key
    @model = model
    @timeout = timeout
  end

  # Returns the parsed JSON object the model produced for the given schema.
  def generate_json(system:, prompt:, schema:)
    uri = URI("#{BASE_URL}/models/#{@model}:generateContent")
    req = Net::HTTP::Post.new(uri)
    req["x-goog-api-key"] = @api_key
    req["Content-Type"] = "application/json"
    req.body = {
      systemInstruction: { parts: [ { text: system } ] },
      contents: [ { parts: [ { text: prompt } ] } ],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 }
    }.to_json

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 3, read_timeout: @timeout) { |http| http.request(req) }
    unless response.is_a?(Net::HTTPSuccess)
      raise Error.new("Gemini returned #{response.code}", status: response.code.to_i, retry_after: response["Retry-After"]&.to_f)
    end

    text = JSON.parse(response.body).dig("candidates", 0, "content", "parts")&.map { |p| p["text"] }&.compact&.join
    raise Error, "Gemini returned no text" if text.blank?

    JSON.parse(text)
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError => e
    raise Error, "Gemini request failed: #{e.class}"
  rescue JSON::ParserError
    raise Error, "Gemini returned unreadable JSON"
  end
end
