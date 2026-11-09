require "net/http"
require "json"

# Thin client for the Gemini generateContent API with a JSON response schema. Configured only from the
# environment: GEMINI_API_KEY, GEMINI_MODEL (default below) and GEMINI_FALLBACK_MODELS (comma separated, optional).
# Free-tier quotas are per model and per day, so when a model refuses a call for quota or overload (FALLBACK_STATUSES)
# the same request goes to the next model on the list; #model then names the model that answered. The model is pinned here because Google retires
# models for new keys without notice (gemini-2.5-flash already answers 404 to keys created after its cutoff),
# and the preview models are throttled to a handful of calls a minute on the free tier.
class GeminiClient
  BASE_URL = "https://generativelanguage.googleapis.com/v1beta".freeze
  DEFAULT_MODEL = "gemini-3.1-flash-lite".freeze
  # Free-tier embedding model; 768 dimensions match the vector column of case_embeddings.
  EMBEDDING_MODEL = "gemini-embedding-001".freeze
  EMBEDDING_DIMENSIONS = 768

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

    # Refusals that say "not this model right now" (quota, overload, retired), so another model may answer.
    FALLBACK_STATUSES = [ 404, 429, 503 ].freeze
    def model_refused? = FALLBACK_STATUSES.include?(status)
  end

  def self.configured?
    ENV["GEMINI_API_KEY"].present?
  end

  def initialize(api_key: ENV["GEMINI_API_KEY"], model: ENV.fetch("GEMINI_MODEL", DEFAULT_MODEL),
                 fallback_models: ENV.fetch("GEMINI_FALLBACK_MODELS", ""), timeout: 8)
    raise Error, "Gemini is not configured" if api_key.blank?

    @api_key = api_key
    @models = [ model, *fallback_models.to_s.split(",").map(&:strip) ].reject(&:blank?).uniq
    @model = @models.first
    @timeout = timeout
  end

  # The model that answered the last call (the first model before any call).
  attr_reader :model

  # Returns the parsed JSON object the model produced for the given schema.
  def generate_json(system:, prompt:, schema:)
    body = {
      systemInstruction: { parts: [ { text: system } ] },
      contents: [ { parts: [ { text: prompt } ] } ],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 }
    }
    response = nil
    @models.each_with_index do |name, index|
      response = post("#{BASE_URL}/models/#{name}:generateContent", body)
      @model = name
      break
    rescue Error => e
      raise unless e.model_refused? && index < @models.size - 1

      Rails.logger.info("Gemini #{name} refused (#{e.status}); trying #{@models[index + 1]}")
    end
    text = JSON.parse(response.body).dig("candidates", 0, "content", "parts")&.map { |p| p["text"] }&.compact&.join
    raise Error, "Gemini returned no text" if text.blank?

    JSON.parse(text)
  rescue JSON::ParserError
    raise Error, "Gemini returned unreadable JSON"
  end

  # The embedding of one text, as an array of EMBEDDING_DIMENSIONS floats.
  def embed(text)
    response = post("#{BASE_URL}/models/#{EMBEDDING_MODEL}:embedContent",
                    { content: { parts: [ { text: text } ] }, taskType: "SEMANTIC_SIMILARITY", outputDimensionality: EMBEDDING_DIMENSIONS })
    values = JSON.parse(response.body).dig("embedding", "values")
    raise Error, "Gemini returned a vector of the wrong size" unless values.is_a?(Array) && values.size == EMBEDDING_DIMENSIONS

    values
  rescue JSON::ParserError
    raise Error, "Gemini returned unreadable JSON"
  end

  private

  def post(url, body)
    uri = URI(url)
    req = Net::HTTP::Post.new(uri)
    req["x-goog-api-key"] = @api_key
    req["Content-Type"] = "application/json"
    req.body = body.to_json

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 3, read_timeout: @timeout) { |http| http.request(req) }
    unless response.is_a?(Net::HTTPSuccess)
      raise Error.new("Gemini returned #{response.code}", status: response.code.to_i, retry_after: response["Retry-After"]&.to_f)
    end

    response
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError => e
    raise Error, "Gemini request failed: #{e.class}"
  end
end
