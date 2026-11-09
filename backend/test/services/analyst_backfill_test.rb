require "test_helper"

class AnalystBackfillTest < ActiveSupport::TestCase
  class FakeAnalyst
    attr_reader :facts_seen

    def initialize(verdicts)
      @verdicts = verdicts
      @facts_seen = []
    end

    def verdict(facts)
      @facts_seen << facts
      @verdicts.shift
    end
  end

  setup do
    @user = users(:one)
    @held = 2.times.map { |i| held_payment(created_at: i.minutes.ago) }
    @read = held_payment(ai_verdict: { "action" => "approve", "confidence" => 0.6, "explanation" => "x" })
    @captured = @user.transactions.create!(amount: 20, payment_method: "wallet", device_id: "device-2", status: "SUCCESS", risk_score: 0, paypal_status: "CAPTURED")
    FraudEvaluation.create!(financial_transaction: @captured, risk_score: 0)
  end

  def held_payment(ai_verdict: nil, created_at: Time.current)
    payment = @user.transactions.create!(amount: 300, payment_method: "wallet", device_id: "device-secret-1", status: "FLAGGED",
                                         risk_score: 30, paypal_status: "HELD", created_at: created_at)
    FraudEvaluation.create!(financial_transaction: payment, risk_score: 30, rules_triggered: "UNTRUSTED_DEVICE", ai_verdict: ai_verdict)
    payment
  end

  test "reads only held payments with no verdict, marks the verdict as read after the hold and keeps the status" do
    verdict = { action: "review", confidence: 0.7, explanation: "New device.", timeline: [], model: "fake" }
    analyst = FakeAnalyst.new([ verdict.dup, verdict.dup ])
    pauses = []
    report = AnalystBackfill.new(analyst: analyst, sleeper: ->(s) { pauses << s }, now: -> { Time.utc(2026, 11, 9, 12) }).run

    assert_equal({ read: 2, skipped: 0, left: 0 }, report)
    assert_equal [ AnalystBackfill::DEFAULT_PAUSE ], pauses
    @held.each do |payment|
      stored = payment.reload.fraud_evaluation.ai_verdict
      assert_equal "review", stored["action"]
      assert_equal true, stored["read_after_hold"]
      assert_equal "2026-11-09T12:00:00Z", stored["read_at"]
      assert_equal "HELD", payment.paypal_status
      assert payment.flagged?
    end
    assert_equal "approve", @read.reload.fraud_evaluation.ai_verdict["action"]
    assert_nil @captured.reload.fraud_evaluation.ai_verdict
    assert_includes analyst.facts_seen.first[:rules_triggered], "UNTRUSTED_DEVICE"
    refute_includes analyst.facts_seen.first.to_json, "device-secret-1"
  end

  test "a skipped read leaves the row for the next run, and LIMIT caps the batch" do
    report = AnalystBackfill.new(analyst: FakeAnalyst.new([ nil ]), limit: 1, sleeper: ->(_) { }).run

    assert_equal({ read: 0, skipped: 1, left: 2 }, report)
    assert @held.all? { |payment| payment.reload.fraud_evaluation.ai_verdict.nil? }
  end
end
