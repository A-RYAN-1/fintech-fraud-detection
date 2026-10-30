require "test_helper"

class RuleProposerTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  class FakeClient
    def capture(_auth_id, request_id:) = { "id" => "CAP-1" }
    def void(_auth_id, request_id:) = {}
  end

  setup do
    RiskRuleConfig.reset_cache!
    FraudEvaluation.delete_all
    Transaction.delete_all
    @user = users(:second_admin)
    @user.devices.create!(device_id: "trusted", first_seen_at: 2.days.ago)
    3.times do |i|
      payment = @user.transactions.create!(amount: 100, payment_method: "wallet", device_id: "trusted", status: "SUCCESS", created_at: (3 - i).hours.ago)
      FraudEvaluation.create!(financial_transaction: payment, risk_score: 0, ml_score: 0.0)
    end
  end

  teardown { RiskRuleConfig.reset_cache! }

  # A 250 payment from another device: 20 for twice the average plus 30 for the device is 50, which is FLAGGED.
  def flagged_payment(label: nil, device: "other")
    payment = @user.transactions.create!(amount: 250, payment_method: "wallet", device_id: device, status: "FLAGGED", risk_score: 50,
                                         paypal_status: "HELD", created_at: 1.minute.ago)
    labelled(payment, 50, "AMOUNT_DEVIATION_LOW,UNTRUSTED_DEVICE", label)
  end

  # A 250 payment from the trusted device: only the 20 for twice the average, so it is approved.
  def approved_payment(label: nil)
    payment = @user.transactions.create!(amount: 250, payment_method: "wallet", device_id: "trusted", status: "SUCCESS", risk_score: 20,
                                         paypal_status: "CAPTURED", created_at: 1.minute.ago)
    labelled(payment, 20, "AMOUNT_DEVIATION_LOW", label)
  end

  def labelled(payment, score, rules, label)
    FraudEvaluation.create!(financial_transaction: payment, risk_score: score, rules_triggered: rules, ml_score: 0.0,
                            human_label: label, label_source: label && "decision", labeled_by: label && users(:reviewer), labeled_at: label && Time.current)
  end

  test "the backtest reproduces the stored statuses and writes nothing" do
    flagged_payment(label: "approve")
    assert_no_difference -> { RiskRuleSetting.count } do
      report = RuleBacktest.new({ "flag_threshold" => 51 }).call
      assert_equal 1.0, report[:fidelity][:rate]
      assert_equal 4, report[:replayed]
      assert_equal 1, report[:baseline][:flagged]
      assert_equal 1, report[:baseline][:false_alarms]
      assert_equal 0, report[:candidate][:false_alarms]
      assert_equal(-1, report[:delta][:false_alarms])
      assert_equal "FLAGGED", report[:flips].first[:from]
      assert_equal "SUCCESS", report[:flips].first[:to]
    end
  end

  test "a person approving a flagged payment drafts a change, and the live rule stays as it was" do
    evaluation = flagged_payment(label: "approve")
    proposal = RuleProposer.new(evaluation).propose

    assert proposal.pending?
    assert_equal "false_alarm", proposal.trigger_kind
    assert_equal evaluation.financial_transaction, proposal.source_payment
    assert_not_equal proposal.proposed_value, proposal.current_value
    assert_equal 0, proposal.backtest["delta"]["misses"]
    assert_equal(-1, proposal.backtest["delta"]["false_alarms"])
    assert_equal 30, RiskRuleConfig.get("flag_threshold")
    assert_equal 0, RiskRuleSetting.count
    assert_equal 1, AuditLog.where(event_type: "RULE_PROPOSAL_DRAFTED").count
  end

  test "a blocked false alarm is moved to flagged, never to approved" do
    payment = @user.transactions.create!(amount: 250, payment_method: "wallet", device_id: "other", status: "BLOCKED", risk_score: 75, paypal_status: "VOIDED", created_at: 1.minute.ago)
    evaluation = labelled(payment, 75, "AMOUNT_DEVIATION_LOW,UNTRUSTED_DEVICE", "approve")
    RiskRuleSetting.create!(key: "untrusted_device_risk", value: 55)
    RiskRuleConfig.reset_cache!

    proposal = RuleProposer.new(evaluation).propose
    assert_not_nil proposal
    assert_equal "BLOCKED", proposal.backtest["focus"]["from"]
    assert_equal "FLAGGED", proposal.backtest["focus"]["to"]
  end

  test "a missed payment is moved to flagged, never to blocked" do
    evaluation = approved_payment(label: "block")
    proposal = RuleProposer.new(evaluation).propose

    assert_equal "miss", proposal.trigger_kind
    assert_equal "SUCCESS", proposal.backtest["focus"]["from"]
    assert_equal "FLAGGED", proposal.backtest["focus"]["to"]
  end

  test "no draft when the rules and the person agree or no decision exists" do
    assert_nil RuleProposer.new(flagged_payment(label: "block")).propose
    assert_nil RuleProposer.new(approved_payment(label: "approve")).propose
    proposer = RuleProposer.new(flagged_payment)
    assert_nil proposer.propose
    assert_match(/no human decision/, proposer.reason_none)
  end

  test "a change that would create a new miss is not drafted" do
    flagged_payment(label: "block")
    proposer = RuleProposer.new(flagged_payment(label: "approve"))
    assert_nil proposer.propose
    assert_match(/new miss/, proposer.reason_none)
  end

  test "the same draft is not made twice while the first is pending" do
    evaluation = flagged_payment(label: "approve")
    assert_not_nil RuleProposer.new(evaluation).propose
    assert_nil RuleProposer.new(evaluation).propose
    assert_equal 1, RuleProposal.count
  end

  test "a decision on a held payment queues a draft, and a failing draft never reaches the decision" do
    payment = @user.transactions.create!(amount: 250, payment_method: "wallet", device_id: "other", status: "FLAGGED", risk_score: 50,
                                         paypal_status: "HELD", paypal_authorization_id: "AUTH-1", created_at: 1.minute.ago)
    evaluation = labelled(payment, 50, "AMOUNT_DEVIATION_LOW,UNTRUSTED_DEVICE", nil)

    assert_enqueued_with(job: RuleProposalJob, args: [ evaluation.id ]) do
      PaypalActions.new(client: FakeClient.new).capture(payment, actor: users(:reviewer), reason: "known customer")
    end
    perform_enqueued_jobs(only: RuleProposalJob)
    assert_equal 1, RuleProposal.pending.count

    assert_nil RuleProposer.after_label(nil)
  end

  test "the processor gives the same result live and replayed" do
    payment = @user.transactions.create!(amount: 250, payment_method: "wallet", device_id: "other", status: "PENDING")
    stats = @user.user_transaction_stat || @user.create_user_transaction_stat!
    stats.update!(total_txns: 3, total_amount: 300, avg_amount: 100)
    live = RiskRulesProcessor.new(payment, @user, stats).process
    history = RiskRulesProcessor::History.new(recent_count: @user.transactions.where("created_at > ?", 60.seconds.ago).count, trusted_device_id: "trusted")
    replay = RiskRulesProcessor.new(payment, nil, stats, history: history).process
    assert_equal live, replay
  end
end
