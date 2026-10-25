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

    assert_equal({ action: "review", confidence: 0.82, explanation: "Large amount on a new device.", model: "fake-model" }, verdict)
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
end
