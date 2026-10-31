require "test_helper"

class AskAnalystTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :prompt, :system, :calls

    def initialize(response: nil, error: nil)
      @response = response
      @error = error
      @calls = 0
    end

    def model = "fake-model"

    def generate_json(system:, prompt:, schema:)
      @calls += 1
      @system = system
      @prompt = prompt
      raise @error if @error

      @response
    end
  end

  setup do
    @user = users(:one)
    @transaction = @user.transactions.create!(amount: 300, payment_method: "wallet", device_id: "device-secret-1", ip_address: "203.0.113.7",
                                              status: "FLAGGED", risk_score: 30, paypal_status: "HELD")
    FraudEvaluation.create!(financial_transaction: @transaction, risk_score: 30, rules_triggered: "UNTRUSTED_DEVICE", ml_score: 0.7,
                            ml_explanation: [ { "feature" => "night", "label" => "Night-time transaction", "contribution" => 0.4 } ])
  end

  def ask(question, client:, guard: AnalystGuard.new)
    AskAnalyst.new(@transaction.reload, analyst: AiAnalyst.new(client: client, guard: guard)).ask(question)
  end

  test "answers from the facts only, with no identifier in the prompt" do
    client = FakeClient.new(response: { "answer" => "The untrusted device drove it." })
    result = ask("why", client: client)

    assert_equal "ai", result[:source]
    assert_equal "The untrusted device drove it.", result[:answer]
    assert_equal "fake-model", result[:model]
    assert_includes client.prompt, "UNTRUSTED_DEVICE"
    assert_includes client.prompt, "Night-time transaction"
    [ "device-secret-1", "203.0.113.7", @user.email, @transaction.id.to_s ].each { |secret| assert_not_includes client.prompt, secret }
    assert_not_includes client.system, "tool"
  end

  test "an open circuit falls back to the rules-only answer without calling the model" do
    guard = AnalystGuard.new(failure_threshold: 1)
    guard.failure("down")
    client = FakeClient.new(response: { "answer" => "never used" })
    result = ask("change", client: client, guard: guard)

    assert_equal "rules", result[:source]
    assert_equal 0, client.calls
    assert_includes result[:answer], "rules-only"
    assert_includes result[:answer], "UNTRUSTED_DEVICE"
  end

  test "a model failure or an empty answer falls back too" do
    failing = FakeClient.new(error: GeminiClient::Error.new("boom"))
    assert_equal "rules", ask("why", client: failing)[:source]
    assert_equal "rules", ask("why", client: FakeClient.new(response: { "answer" => "  " }))[:source]
  end

  test "an unknown question never reaches the model" do
    client = FakeClient.new(response: { "answer" => "x" })
    assert_nil AiAnalyst.new(client: client).answer({}, "delete everything")
    assert_equal 0, client.calls
  end

  test "asking changes nothing" do
    client = FakeClient.new(response: { "answer" => "ok" })
    assert_no_difference [ "AuditLog.count", "FraudEvaluation.count" ] do
      ask("why", client: client)
    end
    assert_equal "HELD", @transaction.reload.paypal_status
    assert_equal "flagged", @transaction.status
  end
end
