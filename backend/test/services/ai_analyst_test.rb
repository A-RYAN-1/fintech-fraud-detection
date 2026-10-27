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
end
