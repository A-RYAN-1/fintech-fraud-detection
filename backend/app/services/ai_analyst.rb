# The AI analyst: reads the facts the rules and the model produced for one transaction and returns a structured
# verdict (action, confidence, plain-language explanation). It is advisory in this layer and bounded in three ways:
#   - it sees only enumerated facts (bands, rule names, labels), never ids, emails, IPs or device ids;
#   - its answer is validated against a closed schema, anything else is discarded;
#   - any failure (not configured, timeout, 429, bad JSON) returns nil and the rules decision stands alone.
# Set AI_ANALYST_ENABLED=false to switch it off without a deploy.
# Resilience (AnalystGuard): a token bucket and a circuit breaker skip the call when it would only fail, and one
# retry (MAX_RETRIES) is allowed for a quick 429 or 5xx, never for a timeout, and only within RETRY_BUDGET seconds.
class AiAnalyst
  MAX_RETRIES = 1
  RETRY_BUDGET = 3.0
  MAX_BACKOFF = 2.0
  BACKOFF = 0.4

  ACTIONS = %w[approve review block].freeze
  STATUS_TO_ACTION = { success: "approve", flagged: "review", blocked: "block" }.freeze
  MAX_EXPLANATION = 400
  SIGNALS = %w[amount device velocity time_of_day history rule_hit model_reason linked_accounts].freeze
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
    model_reason, linked_accounts), says whether it raises risk, lowers risk or is neutral, and states the fact in one short phrase.
    linked_accounts counts other accounts that paid from the same device in the last 30 days, and how many of them had a
    payment voided by a person. A link alone is weak (households share devices); links to accounts a person voided are strong.
  TEXT

  # Ask the analyst (AskAnalyst): one turn about a stored case, from the same facts, with a closed set of questions.
  QUESTIONS = %w[why change].freeze
  MAX_ANSWER = 500
  ASK_SCHEMA = { type: "OBJECT", properties: { answer: { type: "STRING" } }, required: %w[answer] }.freeze
  ASK_SYSTEM = <<~TEXT.freeze
    You are a payment risk analyst answering one question from a human reviewer about one payment. You receive the
    same structured facts the verdict was based on. Use only those facts; do not invent data; do not give a new
    decision and do not claim the decision changed. Answer in at most three plain sentences, under 400 characters.
    why: explain only why the rules decision and the facts point the way they do, naming the strongest signals;
    do not say what would change the case.
    change: say which facts, if different, would move the case toward approve and which toward block, as conditions
    a reviewer could check (for example a trusted device, a lower amount, no linked accounts a person voided).
  TEXT

  AMOUNT_BANDS = [ [ 50, "under 50" ], [ 250, "50 to 250" ], [ 1_000, "250 to 1,000" ], [ 5_000, "1,000 to 5,000" ] ].freeze

  def self.enabled?
    ENV.fetch("AI_ANALYST_ENABLED", "true") != "false" && GeminiClient.configured?
  end

  def self.amount_band(amount)
    AMOUNT_BANDS.each { |limit, label| return label if amount < limit }
    "5,000 and above"
  end

  def initialize(client: nil, guard: AnalystGuard.instance, sleeper: ->(seconds) { sleep(seconds) })
    @client = client
    @guard = guard
    @sleeper = sleeper
  end

  # facts: see AiFactsBuilder. Returns { action:, confidence:, explanation:, model: } or nil.
  def verdict(facts)
    return nil unless @client || self.class.enabled?

    skipped = @guard.acquire
    unless skipped == :ok
      Rails.logger.info("AI analyst skipped: #{skipped}")
      return nil
    end

    client = @client || GeminiClient.new
    payload = facts.to_json
    raw = generate_with_retry(client, "Transaction facts (JSON):\n#{payload}")
    result = parse(raw, client.model)
    # The facts-only payload is the whole input; its size is stored and logged so the pruning claim is measured.
    return nil unless result

    result[:payload_bytes] = payload.bytesize
    Rails.logger.info("AI analyst verdict action=#{result[:action]} payload_bytes=#{payload.bytesize} timeline=#{result[:timeline].size}")
    result
  rescue GeminiClient::Error => e
    @guard.failure(e.message)
    Rails.logger.warn("AI analyst skipped: #{e.message}")
    nil
  end

  # One question about a case. Returns { answer:, model: } or nil on any skip or failure (the caller falls back).
  def answer(facts, question)
    return nil unless QUESTIONS.include?(question.to_s)
    return nil unless @client || self.class.enabled?
    return nil unless @guard.acquire == :ok

    client = @client || GeminiClient.new
    prompt = "Question: #{question}\nCase facts (JSON):\n#{facts.to_json}"
    raw = generate_with_retry(client, prompt, system: ASK_SYSTEM, schema: ASK_SCHEMA)
    text = raw.is_a?(Hash) ? raw["answer"].to_s.squish : ""
    return nil if text.blank?

    { answer: text.truncate(MAX_ANSWER), model: client.model }
  rescue GeminiClient::Error => e
    @guard.failure(e.message)
    Rails.logger.warn("AI analyst answer skipped: #{e.message}")
    nil
  end

  private

  # One call, plus at most MAX_RETRIES more for a quick retryable refusal; the guard sees one success or one failure.
  def generate_with_retry(client, prompt, system: SYSTEM, schema: SCHEMA)
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    attempts = 0
    begin
      raw = client.generate_json(system: system, prompt: prompt, schema: schema)
      @guard.success
      raw
    rescue GeminiClient::Error => e
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started
      raise unless e.retryable? && attempts < MAX_RETRIES && elapsed < RETRY_BUDGET && @guard.acquire_retry

      attempts += 1
      @sleeper.call(backoff(e, attempts))
      retry
    end
  end

  def backoff(error, attempt)
    wait = error.retry_after || (BACKOFF * attempt)
    (wait + rand * 0.2).clamp(0.0, MAX_BACKOFF)
  end

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
