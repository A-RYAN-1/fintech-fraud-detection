# Optional: asks the AI analyst for a likely cause of one incident. It sees the incident kind, the counts and the scrubbed
# detail, never a payment, a person or a credential. The answer is length-limited, stored as a note that is labelled
# unverified, and ignored if the analyst is off, skipped by the guard (rate limit, open circuit) or fails.
class IncidentAdvisor
  MAX_NOTE = 400

  SCHEMA = {
    type: "OBJECT",
    properties: { likely_cause: { type: "STRING" }, first_check: { type: "STRING" } },
    required: %w[likely_cause first_check]
  }.freeze

  SYSTEM = <<~TEXT.freeze
    You help an engineer read an incident from a payments app that uses PayPal, a Rails API and background jobs. You get the
    kind of failure, how often it happened and the last error message. Give the most likely cause in one sentence and the one
    thing to check first in one sentence. Use only what is given; if it is not enough to say, say so. Do not suggest code
    changes, rule changes or touching payments.
  TEXT

  # `client` is for tests; in production the configured Gemini client is used, and only when the analyst is enabled.
  def self.suggest(incident, guard: AnalystGuard.instance, client: nil)
    return nil unless client || AiAnalyst.enabled?
    return nil unless guard.acquire == :ok

    result = (client || GeminiClient.new).generate_json(system: SYSTEM, prompt: prompt(incident), schema: SCHEMA)
    guard.success
    cause = result["likely_cause"].to_s.squish
    check = result["first_check"].to_s.squish
    return nil if cause.blank? || check.blank?

    "Likely cause: #{cause} First check: #{check}".first(MAX_NOTE)
  rescue GeminiClient::Error => e
    guard.failure(e.message)
    nil
  end

  def self.prompt(incident)
    <<~TEXT
      Kind: #{incident.kind}
      Title: #{incident.title}
      Occurrences: #{incident.occurrences} between #{incident.first_seen_at.utc.iso8601} and #{incident.last_seen_at.utc.iso8601}
      Details: #{incident.sample.except("payment_id", "debug_id").to_json}
      Last message: #{incident.detail}
    TEXT
  end
  private_class_method :prompt
end
