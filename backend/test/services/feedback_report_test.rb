require "test_helper"

class FeedbackReportTest < ActiveSupport::TestCase
  class FakeClient
    def capture(_auth_id, request_id:) = { "id" => "CAP-1" }
    def void(_auth_id, request_id:) = {}
    def refund(_capture_id, request_id:, amount: nil) = { "id" => "REF-1" }
  end

  setup do
    RiskRuleConfig.reset_cache!
    @actions = PaypalActions.new(client: FakeClient.new)
    @threshold = MlRiskScorer.model.fetch("flag_threshold")
  end

  teardown { RiskRuleConfig.reset_cache! }

  def held_payment(status: "FLAGGED", ml_score: 0.1, ai: nil)
    payment = users(:one).transactions.create!(amount: 100, payment_method: "wallet", device_id: "d", status: status,
                                               paypal_status: "HELD", paypal_authorization_id: "AUTH-1")
    FraudEvaluation.create!(financial_transaction: payment, risk_score: 40, ml_score: ml_score, ai_verdict: ai)
    payment
  end

  def labelled(label, status:, ml_score:, ai_action: nil, at: Time.current)
    payment = held_payment(status: status, ml_score: ml_score, ai: ai_action && { "action" => ai_action, "confidence" => 0.9 })
    payment.fraud_evaluation.update!(human_label: label, label_source: "decision", labeled_by: users(:reviewer), labeled_at: at)
    payment
  end

  test "a person capture of a held payment labels it approve, with who and when" do
    payment = held_payment
    @actions.capture(payment, actor: users(:reviewer), reason: "looks fine")
    evaluation = payment.fraud_evaluation.reload
    assert_equal "approve", evaluation.human_label
    assert_equal "decision", evaluation.label_source
    assert_equal users(:reviewer), evaluation.labeled_by
    assert_not_nil evaluation.labeled_at
  end

  test "a person void of a held payment labels it block" do
    payment = held_payment
    @actions.void(payment, actor: users(:reviewer), reason: "ring")
    assert_equal "block", payment.fraud_evaluation.reload.human_label
  end

  test "the agent own actions are not labels" do
    payment = held_payment
    @actions.capture(payment, actor: "Agent", reason: "inside the limits", auto: true)
    assert_nil payment.fraud_evaluation.reload.human_label
  end

  test "capturing a payment that was not held is not a label" do
    payment = held_payment
    payment.update!(paypal_status: "AUTHORIZED")
    @actions.capture(payment, actor: users(:reviewer), reason: "ok")
    assert_nil payment.fraud_evaluation.reload.human_label
  end

  test "a full refund turns an approval into a block, a partial refund does not" do
    payment = held_payment
    @actions.capture(payment, actor: users(:reviewer), reason: "ok")
    @actions.refund(payment, actor: users(:admin), reason: "part", amount: 10)
    assert_equal "approve", payment.fraud_evaluation.reload.human_label
    @actions.refund(payment, actor: users(:admin), reason: "rest")
    evaluation = payment.fraud_evaluation.reload
    assert_equal "block", evaluation.human_label
    assert_equal "refund", evaluation.label_source
    assert_equal users(:admin), evaluation.labeled_by
  end

  test "summary scores each signal against the human label" do
    labelled("approve", status: "SUCCESS", ml_score: @threshold + 0.1, ai_action: "approve") # ml false alarm
    labelled("block", status: "BLOCKED", ml_score: @threshold + 0.1, ai_action: "approve")   # ai miss
    labelled("block", status: "SUCCESS", ml_score: 0.0)                                      # rules and ml miss, no ai
    labelled("approve", status: "FLAGGED", ml_score: 0.0, ai_action: "review")               # rules and ai false alarm

    summary = FeedbackReport.new.summary
    assert_equal 4, summary[:labelled]
    assert_equal 2, summary[:human_approve]
    assert_equal 2, summary[:human_block]
    assert_equal({ answered: 4, agree: 2, agreement_rate: 0.5, false_alarms: 1, misses: 1 }, summary[:signals]["rules"])
    assert_equal({ answered: 4, agree: 2, agreement_rate: 0.5, false_alarms: 1, misses: 1 }, summary[:signals]["ml"])
    assert_equal({ answered: 3, agree: 1, agreement_rate: 0.333, false_alarms: 1, misses: 1 }, summary[:signals]["ai"])
  end

  test "agreement is nil for a signal that never answered" do
    labelled("approve", status: "SUCCESS", ml_score: 0.0)
    assert_nil FeedbackReport.new.summary[:signals]["ai"][:agreement_rate]
  end

  test "daily series groups by the day of the decision" do
    labelled("approve", status: "SUCCESS", ml_score: 0.0, at: Time.zone.parse("2026-10-01 10:00"))
    labelled("block", status: "BLOCKED", ml_score: @threshold + 0.1, at: Time.zone.parse("2026-10-01 15:00"))
    labelled("approve", status: "FLAGGED", ml_score: 0.0, at: Time.zone.parse("2026-10-02 10:00"))

    daily = FeedbackReport.new.summary[:daily]
    assert_equal %w[2026-10-01 2026-10-02], daily.map { |d| d[:date] }
    assert_equal [ 2, 1 ], daily.map { |d| d[:labelled] }
    assert_equal [ 1.0, 0.0 ], daily.map { |d| d["rules"] }
  end

  test "disagreements list only rows where a signal disagreed and the signal filter narrows them" do
    labelled("approve", status: "SUCCESS", ml_score: 0.0, ai_action: "approve")               # all agree
    labelled("approve", status: "FLAGGED", ml_score: 0.0, ai_action: "approve")               # rules only
    labelled("approve", status: "SUCCESS", ml_score: @threshold + 0.1, ai_action: "review")   # ml and ai

    report = FeedbackReport.new
    assert_equal 2, report.disagreements.size
    assert_equal [ %w[ml ai], %w[rules] ], report.disagreements.map { |r| r[:disagreeing] }.sort
    assert_equal 1, report.disagreements(signal: "rules").size
    assert_equal 1, report.disagreements(signal: "ml").size
    assert_equal 1, report.disagreements(signal: "ai").size
  end

  test "unlabelled payments are not in the report" do
    held_payment
    assert_equal 0, FeedbackReport.new.summary[:labelled]
  end
end
