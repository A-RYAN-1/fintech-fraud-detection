require "test_helper"

class TransactionRiskEvaluatorTest < ActiveSupport::TestCase
  def setup
    @user = users(:one)
    @stat = user_transaction_stats(:one)
    @device = devices(:one)
  end

  test "should evaluate low risk transaction as success" do
    transaction = Transaction.create!(
      amount: 100,
      payment_method: "card",
      device_id: @device.device_id,
      user: @user
    )
    
    evaluator = TransactionRiskEvaluator.new(transaction)
    status = evaluator.evaluate
    
    assert_equal :success, status
    assert_equal "success", transaction.reload.status
    assert_equal 0, transaction.risk_score
  end

  test "should flag high amount deviation" do
    # stats.avg_amount is 100. Let's send 1001 (10x deviation)
    transaction = Transaction.create!(
      amount: 1001,
      payment_method: "card",
      device_id: @device.device_id,
      user: @user
    )
    
    evaluator = TransactionRiskEvaluator.new(transaction)
    status = evaluator.evaluate
    
    assert_equal :flagged, status
    assert transaction.risk_score >= 40
  end

  test "should block high risk score" do
    # Trigger multiple rules
    # 1. Untrusted device (30)
    # 2. High amount deviation (40)
    transaction = Transaction.create!(
      amount: 1001,
      payment_method: "card",
      device_id: "untrusted_device",
      user: @user
    )
    
    evaluator = TransactionRiskEvaluator.new(transaction)
    status = evaluator.evaluate
    
    assert_equal :blocked, status
    assert transaction.reload.blocked?
  end

  # minitest 6 no longer ships minitest/mock, so swap the scorer's class method by hand.
  def with_ml_score(result)
    original = MlRiskScorer.method(:score)
    MlRiskScorer.define_singleton_method(:score) { |_vector| result }
    yield
  ensure
    MlRiskScorer.define_singleton_method(:score, original)
  end

  FLAGGING_ML = { probability: 0.9, flag: true, version: "test", reasons: [ { feature: "new_ip", label: "New IP", contribution: 1.2 } ] }.freeze

  test "the ML score lifts a clean transaction to flagged and records why" do
    transaction = Transaction.create!(amount: 100, payment_method: "card", device_id: @device.device_id, user: @user)

    status = with_ml_score(FLAGGING_ML) { TransactionRiskEvaluator.new(transaction).evaluate }

    assert_equal :flagged, status
    evaluation = transaction.reload.fraud_evaluation
    assert_includes evaluation.rules_triggered, "ML_RISK_SCORE"
    assert_in_delta 0.9, evaluation.ml_score
    assert_equal "test", evaluation.ml_version
    assert_equal "new_ip", evaluation.ml_explanation.first["feature"]
  end

  test "the ML score never blocks on its own" do
    transaction = Transaction.create!(amount: 100, payment_method: "card", device_id: @device.device_id, user: @user)

    status = with_ml_score(FLAGGING_ML.merge(probability: 0.999)) { TransactionRiskEvaluator.new(transaction).evaluate }

    assert_not_equal :blocked, status
    assert_operator transaction.reload.risk_score, :<, RiskRuleConfig.get(:block_threshold)
  end

  test "a rule block stays blocked whatever the ML score says" do
    transaction = Transaction.create!(amount: 1001, payment_method: "card", device_id: "untrusted_device", user: @user)

    status = with_ml_score(FLAGGING_ML.merge(flag: false, probability: 0.0)) { TransactionRiskEvaluator.new(transaction).evaluate }

    assert_equal :blocked, status
  end

  test "evaluation falls back to the rules when the ML score is unavailable" do
    transaction = Transaction.create!(amount: 100, payment_method: "card", device_id: @device.device_id, user: @user)

    status = with_ml_score(nil) { TransactionRiskEvaluator.new(transaction).evaluate }

    assert_equal :success, status
    assert_nil transaction.reload.fraud_evaluation.ml_score
  end
end
