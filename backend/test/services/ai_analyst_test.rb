require "test_helper"

class AiAnalystTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :prompt, :system

    def initialize(response = nil, error: nil)
      @response = response
      @error = error
    end

    def model
      "fake-model"
    end

    def generate_json(system:, prompt:, schema:)
      @system = system
      @prompt = prompt
      raise @error if @error

      @response
    end
  end

  FACTS = { amount_band_usd: "1,000 to 5,000", rules_decision: "review" }.freeze

  test "returns the validated verdict with the model name" do
    client = FakeClient.new({ "action" => "review", "confidence" => 0.82, "explanation" => "Large amount on a new device." })
    verdict = AiAnalyst.new(client: client).verdict(FACTS)

    assert_equal "review", verdict[:action]
    assert_equal 0.82, verdict[:confidence]
    assert_equal "Large amount on a new device.", verdict[:explanation]
    assert_equal "fake-model", verdict[:model]
    assert_equal [], verdict[:timeline]
  end

  test "sends only the facts it was given" do
    client = FakeClient.new({ "action" => "approve", "confidence" => 0.9, "explanation" => "Nothing unusual." })
    AiAnalyst.new(client: client).verdict(FACTS)

    assert_includes client.prompt, "1,000 to 5,000"
    assert_includes client.system, "payment risk analyst"
  end

  test "discards an action outside the closed set" do
    client = FakeClient.new({ "action" => "refund_everything", "confidence" => 0.9, "explanation" => "x" })
    assert_nil AiAnalyst.new(client: client).verdict(FACTS)
  end

  test "discards a missing confidence or an empty explanation" do
    assert_nil AiAnalyst.new(client: FakeClient.new({ "action" => "block", "explanation" => "x" })).verdict(FACTS)
    assert_nil AiAnalyst.new(client: FakeClient.new({ "action" => "block", "confidence" => 0.5, "explanation" => "  " })).verdict(FACTS)
  end

  test "clamps confidence and truncates a long explanation" do
    client = FakeClient.new({ "action" => "block", "confidence" => 7, "explanation" => "word " * 200 })
    verdict = AiAnalyst.new(client: client).verdict(FACTS)

    assert_equal 1.0, verdict[:confidence]
    assert_operator verdict[:explanation].length, :<=, AiAnalyst::MAX_EXPLANATION
  end

  test "returns nil instead of raising when the client fails" do
    client = FakeClient.new(error: GeminiClient::Error.new("Gemini returned 429"))
    assert_nil AiAnalyst.new(client: client).verdict(FACTS)
  end

  test "returns nil for a response that is not an object" do
    assert_nil AiAnalyst.new(client: FakeClient.new([ 1, 2 ])).verdict(FACTS)
  end

  test "is off without a key or when switched off" do
    ENV.delete("GEMINI_API_KEY")
    assert_nil AiAnalyst.new.verdict(FACTS)
  end

  test "amount bands" do
    assert_equal "under 50", AiAnalyst.amount_band(10)
    assert_equal "250 to 1,000", AiAnalyst.amount_band(250)
    assert_equal "5,000 and above", AiAnalyst.amount_band(9_999)
  end

  test "keeps an ordered timeline and drops entries outside the closed sets" do
    client = FakeClient.new({ "action" => "review", "confidence" => 0.8, "explanation" => "x", "timeline" => [
      { "signal" => "device", "impact" => "raises_risk", "detail" => "Different from the trusted device" },
      { "signal" => "ip_address", "impact" => "raises_risk", "detail" => "not an allowed signal" },
      { "signal" => "amount", "impact" => "scary", "detail" => "bad impact" },
      { "signal" => "velocity", "impact" => "neutral", "detail" => " " },
      "junk",
      { "signal" => "amount", "impact" => "raises_risk", "detail" => "3 to 10 times the average" }
    ] })
    verdict = AiAnalyst.new(client: client).verdict(FACTS)

    assert_equal %w[device amount], verdict[:timeline].map { |e| e[:signal] }
  end

  test "caps the timeline and truncates a long detail" do
    entries = Array.new(10) { { "signal" => "rule_hit", "impact" => "raises_risk", "detail" => "word " * 100 } }
    verdict = AiAnalyst.new(client: FakeClient.new({ "action" => "block", "confidence" => 0.9, "explanation" => "x", "timeline" => entries })).verdict(FACTS)

    assert_equal AiAnalyst::MAX_TIMELINE, verdict[:timeline].size
    assert_operator verdict[:timeline].first[:detail].length, :<=, AiAnalyst::MAX_DETAIL
  end

  test "a non-array timeline leaves an empty one and the verdict stands" do
    verdict = AiAnalyst.new(client: FakeClient.new({ "action" => "approve", "confidence" => 0.9, "explanation" => "ok", "timeline" => "none" })).verdict(FACTS)

    assert_equal "approve", verdict[:action]
    assert_equal [], verdict[:timeline]
  end

  test "records the size of the facts payload sent to the model" do
    verdict = AiAnalyst.new(client: FakeClient.new({ "action" => "approve", "confidence" => 0.9, "explanation" => "ok" })).verdict(FACTS)

    assert_equal FACTS.to_json.bytesize, verdict[:payload_bytes]
  end

  GOOD = { "action" => "approve", "confidence" => 0.9, "explanation" => "ok" }.freeze

  # Fails with the given errors in order, then answers GOOD.
  class FlakyClient
    attr_reader :calls

    def initialize(*errors)
      @errors = errors
      @calls = 0
    end

    def model = "flaky"

    def generate_json(**)
      @calls += 1
      error = @errors.shift
      raise error if error

      GOOD
    end
  end

  def analyst(client, guard: AnalystGuard.new, slept: [])
    AiAnalyst.new(client: client, guard: guard, sleeper: ->(seconds) { slept << seconds })
  end

  test "retries once after a quick 503 and returns the verdict" do
    client = FlakyClient.new(GeminiClient::Error.new("Gemini returned 503", status: 503))
    slept = []
    guard = AnalystGuard.new
    verdict = analyst(client, guard: guard, slept: slept).verdict(FACTS)

    assert_equal "approve", verdict[:action]
    assert_equal 2, client.calls
    assert_equal 1, slept.size
    assert_operator slept.first, :<=, AiAnalyst::MAX_BACKOFF
    assert_equal({ retries: 1, successes: 1, failures: 0 }, guard.snapshot.slice(:retries, :successes, :failures))
  end

  test "honours Retry-After but never waits longer than the cap" do
    client = FlakyClient.new(GeminiClient::Error.new("Gemini returned 429", status: 429, retry_after: 30))
    slept = []
    analyst(client, slept: slept).verdict(FACTS)

    assert_equal AiAnalyst::MAX_BACKOFF, slept.first
  end

  test "retries at most once" do
    errors = Array.new(3) { GeminiClient::Error.new("Gemini returned 503", status: 503) }
    client = FlakyClient.new(*errors)
    guard = AnalystGuard.new

    assert_nil analyst(client, guard: guard).verdict(FACTS)
    assert_equal 1 + AiAnalyst::MAX_RETRIES, client.calls
    assert_equal 1, guard.snapshot[:failures]
  end

  test "does not retry a timeout or a non-retryable status" do
    [ GeminiClient::Error.new("Gemini request failed: Net::ReadTimeout"), GeminiClient::Error.new("Gemini returned 404", status: 404) ].each do |error|
      client = FlakyClient.new(error)
      assert_nil analyst(client).verdict(FACTS)
      assert_equal 1, client.calls
    end
  end

  test "does not retry when the bucket has no token left" do
    guard = AnalystGuard.new(capacity: 1, refill_per_minute: 0)
    client = FlakyClient.new(GeminiClient::Error.new("Gemini returned 503", status: 503))

    assert_nil analyst(client, guard: guard).verdict(FACTS)
    assert_equal 1, client.calls
  end

  test "an open circuit skips the call entirely" do
    guard = AnalystGuard.new(failure_threshold: 2)
    client = FlakyClient.new(*Array.new(2) { GeminiClient::Error.new("Gemini returned 404", status: 404) })
    2.times { analyst(client, guard: guard).verdict(FACTS) }
    assert_equal "open", guard.snapshot[:state]

    assert_nil analyst(client, guard: guard).verdict(FACTS)
    assert_equal 2, client.calls, "no third call reached the client"
    assert_equal 1, guard.snapshot[:skipped_open]
  end

  test "an empty bucket skips the call" do
    guard = AnalystGuard.new(capacity: 1, refill_per_minute: 0)
    client = FlakyClient.new
    assert analyst(client, guard: guard).verdict(FACTS)
    assert_nil analyst(client, guard: guard).verdict(FACTS)
    assert_equal 1, client.calls
  end
end
