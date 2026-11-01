require "test_helper"

class CaseNarrativeTest < ActiveSupport::TestCase
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
    @reviewer = users(:reviewer)
    @user = users(:one)
    @transaction = @user.transactions.create!(amount: 300, payment_method: "wallet", device_id: "device-secret-1", ip_address: "203.0.113.7",
                                              status: "FLAGGED", risk_score: 30, paypal_status: "HELD")
    FraudEvaluation.create!(financial_transaction: @transaction, risk_score: 30, rules_triggered: "UNTRUSTED_DEVICE", ml_score: 0.7,
                            ml_explanation: [ { "feature" => "night", "label" => "Night-time transaction", "contribution" => 0.4 } ])
  end

  def draft(client:, guard: AnalystGuard.new)
    CaseNarrative.new(@transaction.reload, analyst: AiAnalyst.new(client: client, guard: guard)).draft!(actor: @reviewer)
  end

  test "drafts from the facts only, with no identifier in the prompt, and saves an audit row" do
    client = FakeClient.new(response: { "summary" => "A 250 to 1,000 USD payment was held.", "indicators" => [ "Untrusted device", "", 7 ],
                                        "reviewer_checks" => [ "Confirm the device with the customer" ] })
    result = nil
    assert_difference -> { AuditLog.where(event_type: "CASE_NARRATIVE").count }, 1 do
      result = draft(client: client)
    end

    assert_equal "ai", result[:source]
    assert_equal "fake-model", result[:model]
    assert_equal [ "Untrusted device" ], result[:indicators], "blank and non-string items are dropped"
    assert_includes client.prompt, "UNTRUSTED_DEVICE"
    [ "device-secret-1", "203.0.113.7", @user.email, @transaction.id.to_s ].each { |secret| assert_not_includes client.prompt, secret }
    assert_not_includes client.system, "tool"

    log = AuditLog.find_by!(event_type: "CASE_NARRATIVE")
    assert_equal @transaction.id.to_s, log.entity_id
    assert_equal @reviewer, log.actor
    assert_equal "ai", log.after_state["source"]
  end

  test "an open circuit uses the fixed rules-only template without calling the model" do
    guard = AnalystGuard.new(failure_threshold: 1)
    guard.failure("down")
    client = FakeClient.new(response: { "summary" => "never used", "indicators" => [], "reviewer_checks" => [] })
    result = draft(client: client, guard: guard)

    assert_equal "rules", result[:source]
    assert_nil result[:model]
    assert_equal 0, client.calls
    assert_includes result[:summary], "rules-only"
    assert_includes result[:summary], "UNTRUSTED_DEVICE"
    assert_not_empty result[:indicators]
    assert_not_empty result[:reviewer_checks]
  end

  test "a model failure or an empty summary falls back to the template" do
    failing = FakeClient.new(error: GeminiClient::Error.new("boom"))
    assert_equal "rules", draft(client: failing)[:source]

    empty = FakeClient.new(response: { "summary" => " ", "indicators" => [ "x" ], "reviewer_checks" => [] })
    assert_equal "rules", draft(client: empty)[:source]
  end

  test "long output is cut to the caps and drafting changes nothing about the payment" do
    items = Array.new(9) { |i| "indicator #{i} " + "x" * 400 }
    client = FakeClient.new(response: { "summary" => "s" * 900, "indicators" => items, "reviewer_checks" => items })
    result = draft(client: client)

    assert_operator result[:summary].length, :<=, AiAnalyst::MAX_NARRATIVE_SUMMARY
    assert_equal AiAnalyst::MAX_NARRATIVE_ITEMS, result[:indicators].size
    assert(result[:indicators].all? { |i| i.length <= AiAnalyst::MAX_NARRATIVE_ITEM })
    assert_equal "HELD", @transaction.reload.paypal_status
    assert_equal "flagged", @transaction.status.to_s.downcase
  end
end
