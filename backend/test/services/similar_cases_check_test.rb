require "test_helper"

class SimilarCasesCheckTest < ActiveSupport::TestCase
  def vec(*head)
    head + Array.new(GeminiClient::EMBEDDING_DIMENSIONS - head.size, 0.0)
  end

  def embedded(vector, label)
    t = users(:one).transactions.create!(amount: 300, payment_method: "wallet", device_id: "d", status: "FLAGGED", risk_score: 30, paypal_status: "HELD")
    FraudEvaluation.create!(financial_transaction: t, risk_score: 30, human_label: label, labeled_at: Time.current)
    CaseEmbedding.create!(financial_transaction: t, embedding: vector, facts_text: "x", model: "m")
  end

  test "an empty store reports a zero sample and claims nothing" do
    result = SimilarCasesCheck.run

    assert_equal 0, result[:sample]
    assert_nil result[:agreement]
    assert_not result[:enough]
  end

  test "reports agreement, the majority baseline and the sample, and flags a small sample" do
    embedded(vec(1.0, 0.0), "block")
    embedded(vec(1.0, 0.1), "block")
    embedded(vec(1.0, 0.2), "block")
    embedded(vec(0.0, 1.0), "approve")
    embedded(vec(0.1, 1.0), "approve")
    embedded(vec(0.0, 1.0, 0.1), "approve")
    embedded(vec(0.5, 0.5), "approve")

    result = SimilarCasesCheck.run

    assert_equal 7, result[:sample]
    assert_equal 3, result[:block]
    assert_equal 4, result[:approve]
    assert_equal (4 / 7.0).round(3), result[:baseline]
    assert_operator result[:agreed], :>=, 6
    assert_equal (result[:agreed] / 7.0).round(3), result[:agreement]
    assert_not result[:enough], "7 cases is below the minimum sample"
  end
end
