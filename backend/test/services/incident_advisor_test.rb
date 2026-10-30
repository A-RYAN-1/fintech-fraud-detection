require "test_helper"

class IncidentAdvisorTest < ActiveSupport::TestCase
  class FakeClient
    attr_reader :prompt

    def initialize(response: nil, error: nil)
      @response = response
      @error = error
    end

    def generate_json(system:, prompt:, schema:)
      @prompt = prompt
      raise @error if @error

      @response
    end
  end

  def incident
    @incident ||= Incident.create!(fingerprint: "paypal_error:capture:502", kind: "paypal_error", title: "PayPal capture failed (HTTP 502)",
                     detail: "Bad gateway", sample: { "action" => "capture", "debug_id" => "dbg-1", "payment_id" => "pay-9" },
                     first_seen_at: 1.hour.ago, last_seen_at: Time.current)
  end

  test "returns a bounded note and keeps payment and debug ids out of the prompt" do
    client = FakeClient.new(response: { "likely_cause" => "PayPal sandbox outage.", "first_check" => "Check the PayPal status page." })
    note = IncidentAdvisor.suggest(incident, client: client)
    assert_equal "Likely cause: PayPal sandbox outage. First check: Check the PayPal status page.", note
    assert_no_match(/pay-9|dbg-1/, client.prompt)
    assert_includes client.prompt, "Bad gateway"
  end

  test "a long answer is cut" do
    client = FakeClient.new(response: { "likely_cause" => "a" * 600, "first_check" => "b" })
    assert_operator IncidentAdvisor.suggest(incident, client: client).length, :<=, IncidentAdvisor::MAX_NOTE
  end

  test "an empty answer, a Gemini error and an open circuit all give nil, and the guard sees the failure" do
    assert_nil IncidentAdvisor.suggest(incident, client: FakeClient.new(response: { "likely_cause" => "", "first_check" => "" }))
    assert_nil IncidentAdvisor.suggest(incident, client: FakeClient.new(error: GeminiClient::Error.new("Gemini returned 503", status: 503)))
    assert_equal 1, AnalystGuard.instance.snapshot[:failures]
    guard = AnalystGuard.new(failure_threshold: 1, cooldown: 60)
    guard.acquire
    guard.failure("x")
    client = FakeClient.new(response: { "likely_cause" => "c", "first_check" => "d" })
    assert_nil IncidentAdvisor.suggest(incident, guard: guard, client: client)
    assert_nil client.prompt
  end

  test "it does nothing when the analyst is switched off" do
    assert_nil IncidentAdvisor.suggest(incident)
  end
end
