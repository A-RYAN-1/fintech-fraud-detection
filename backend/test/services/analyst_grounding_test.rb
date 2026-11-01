require "test_helper"

class AnalystGroundingTest < ActiveSupport::TestCase
  FACTS = {
    amount_band_usd: "250 to 1,000", payment_method: "wallet", time_of_day_utc: "night (00:00 to 06:00)",
    first_transaction_of_user: false, amount_vs_user_average: "3 to 10 times the average", transactions_by_user_last_hour: 2,
    device: "different from the trusted device", linked_accounts: "2 to 3", linked_accounts_voided_by_a_person: "none",
    rules_decision: "flagged", rules_risk_score: 45, rules_triggered: %w[UNTRUSTED_DEVICE HIGH_AMOUNT],
    model_risk_probability: 0.73, model_top_reasons: [ "Night-time transaction", "Amount far above the customer average" ]
  }.freeze

  # Texts a faithful analyst could write from FACTS. Every one must pass.
  FAITHFUL = [
    "A payment in the 250 to 1,000 USD band was flagged with a risk score of 45.",
    "UNTRUSTED_DEVICE and HIGH_AMOUNT fired; the device differs from the trusted device.",
    "The model puts the risk at 73%, driven by the night-time hour.",
    "The model risk probability is 0.73.",
    "The amount is 3 to 10 times the customer average and 2 payments came in the last hour.",
    "Accounts linked through shared devices: 2 to 3.",
    "Confirm the device with the customer and look at the linked accounts panel.",
    "No account linked to this one was voided by a person.",
    "Nothing in the facts suggests a block; a reviewer decides.",
    "Lowering the amount into the 250 to 1,000 band would not change the rules decision."
  ].freeze

  # Texts that cite something outside FACTS, with the issue kind each must raise. Every one must fail.
  FABRICATED = [
    [ "The customer has 4 earlier chargebacks.", :unknown_number ],
    [ "A payment of 4,200 USD was flagged.", :unknown_number ],
    [ "The risk score was 85.", :unknown_number ],
    [ "The model puts the risk at 91%.", :unknown_number ],
    [ "The model risk probability is 0.31.", :unknown_number ],
    [ "Seven payments in 24 hours point to card testing.", :unknown_number ],
    [ "CHARGEBACK_HISTORY fired on this payment.", :unknown_rule ],
    [ "UNTRUSTED_DEVICE and VELOCITY_SPIKE fired.", :unknown_rule ],
    [ "Contact the buyer at jane.doe@example.com.", :identifier ],
    [ "The request came from 203.0.113.7.", :identifier ],
    [ "See transaction 3f2b8c1e-9d4a-4f6b-8a1c-2e7d5b9a0c11.", :identifier ],
    [ "Device 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 was seen before.", :identifier ]
  ].freeze

  def check(text, facts = FACTS) = AnalystGrounding.check(text, facts)

  test "every faithful text passes" do
    FAITHFUL.each do |text|
      result = check(text)
      assert result.passed, "#{text.inspect} should pass but raised #{result.issues.map(&:to_h)}"
    end
  end

  test "every planted fabrication fails with the expected kind" do
    FABRICATED.each do |text, kind|
      result = check(text)
      assert_not result.passed, "#{text.inspect} should fail"
      assert_includes result.issues.map(&:kind), kind, text
    end
  end

  test "corpus size is what the doc reports" do
    assert_equal 10, FAITHFUL.size
    assert_equal 12, FABRICATED.size
  end

  test "a percentage matches the model probability and a comma number matches its band" do
    assert check("73%").passed
    assert check("1,000").passed
    assert_not check("74%").passed
  end

  test "identifiers are reported as identifiers and not again as numbers" do
    result = check("Seen from 203.0.113.7 earlier.")
    assert_equal [ :identifier ], result.issues.map(&:kind)
    assert_equal "ip_address", result.issues.first.detail
  end

  test "text with no numbers or rule names passes" do
    assert check("Nothing unusual stands out.").passed
    assert check(nil).passed
    assert check([ "a", nil, "b" ]).passed
  end

  test "the result serialises for the API and the audit log" do
    assert_equal({ status: "passed", issues: [] }, check("ok").to_h)
    rejected = check("CHARGEBACK_HISTORY").to_h
    assert_equal "rejected", rejected[:status]
    assert_equal({ kind: :unknown_rule, detail: "CHARGEBACK_HISTORY" }, rejected[:issues].first)
  end

  test "rule names count only when they fired on this case" do
    assert_not check("HIGH_AMOUNT fired", FACTS.merge(rules_triggered: [])).passed
  end
end
