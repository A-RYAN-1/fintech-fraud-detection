# The AI analyst: reads the facts the rules and the model produced for one transaction and returns a structured
# verdict (action, confidence, plain-language explanation). It is advisory in this layer and bounded in three ways:
#   - it sees only enumerated facts (bands, rule names, labels), never ids, emails, IPs or device ids;
#   - its answer is validated against a closed schema, anything else is discarded;
#   - any failure (not configured, timeout, 429, bad JSON) returns nil and the rules decision stands alone.
# Set AI_ANALYST_ENABLED=false to switch it off without a deploy.
class AiAnalyst
  ACTIONS = %w[approve review block].freeze
  STATUS_TO_ACTION = { success: "approve", flagged: "review", blocked: "block" }.freeze
  MAX_EXPLANATION = 400
  SIGNALS = %w[amount device velocity time_of_day history rule_hit model_reason].freeze
  IMPACTS = %w[raises_risk lowers_risk neutral].freeze
  MAX_TIMELINE = 6
  MAX_DETAIL = 160

  SCHEMA = {
    type: "OBJECT",
    properties: {
      action: { type: "STRING", enum: ACTIONS },
      confidence: { type: "NUMBER" },
      explanation: { type: "STRING" },
      timeline: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            signal: { type: "STRING", enum: SIGNALS },
            impact: { type: "STRING", enum: IMPACTS },
            detail: { type: "STRING" }
          },
          required: %w[signal impact detail]
        }
      }
    },
    required: %w[action confidence explanation]
  }.freeze

  SYSTEM = <<~TEXT.freeze
    You are a payment risk analyst for a card and wallet checkout. You receive structured facts about one
    transaction: the rules engine result, a statistical risk model result and behaviour signals. Decide whether to
    approve it, send it to human review, or block it.
    Rules: use only the facts given; do not invent data; prefer review over block unless several strong signals
    agree; approve when the signals are weak or absent. confidence is your certainty from 0 to 1. explanation is
    one or two plain sentences for a human reviewer that name the signals you relied on.
    timeline is the evidence behind the verdict, at most six entries ordered from the strongest signal to the
    weakest. Each entry names one signal from the facts (amount, device, velocity, time_of_day, history, rule_hit,
    model_reason), says whether it raises risk, lowers risk or is neutral, and states the fact in one short phrase.
  TEXT

  AMOUNT_BANDS = [ [ 50, "under 50" ], [ 250, "50 to 250" ], [ 1_000, "250 to 1,000" ], [ 5_000, "1,000 to 5,000" ] ].freeze

  def self.enabled?
    ENV.fetch("AI_ANALYST_ENABLED", "true") != "false" && GeminiClient.configured?
  end

  def self.amount_band(amount)
    AMOUNT_BANDS.each { |limit, label| return label if amount < limit }
    "5,000 and above"
  end

  def initialize(client: nil)
    @client = client
  end

  # facts: see AiFactsBuilder. Returns { action:, confidence:, explanation:, model: } or nil.
  def verdict(facts)
    return nil unless @client || self.class.enabled?

    client = @client || GeminiClient.new
    payload = facts.to_json
    result = parse(client.generate_json(system: SYSTEM, prompt: "Transaction facts (JSON):\n#{payload}", schema: SCHEMA), client.model)
    # The facts-only payload is the whole input; its size is stored and logged so the pruning claim is measured.
    return nil unless result

    result[:payload_bytes] = payload.bytesize
    Rails.logger.info("AI analyst verdict action=#{result[:action]} payload_bytes=#{payload.bytesize} timeline=#{result[:timeline].size}")
    result
  rescue GeminiClient::Error => e
    Rails.logger.warn("AI analyst skipped: #{e.message}")
    nil
  end

  private

  def parse(raw, model)
    return nil unless raw.is_a?(Hash)

    action = raw["action"].to_s
    confidence = raw["confidence"]
    explanation = raw["explanation"].to_s.squish
    return nil unless ACTIONS.include?(action) && confidence.is_a?(Numeric) && explanation.present?

    { action: action, confidence: confidence.to_f.clamp(0.0, 1.0).round(2), explanation: explanation.truncate(MAX_EXPLANATION),
      timeline: parse_timeline(raw["timeline"]), model: model }
  end

  # Entries outside the closed signal and impact sets are dropped one by one; a bad timeline never voids the verdict.
  def parse_timeline(raw)
    return [] unless raw.is_a?(Array)

    raw.filter_map do |entry|
      next unless entry.is_a?(Hash)

      signal = entry["signal"].to_s
      impact = entry["impact"].to_s
      detail = entry["detail"].to_s.squish
      next unless SIGNALS.include?(signal) && IMPACTS.include?(impact) && detail.present?

      { signal: signal, impact: impact, detail: detail.truncate(MAX_DETAIL) }
    end.first(MAX_TIMELINE)
  end
end
