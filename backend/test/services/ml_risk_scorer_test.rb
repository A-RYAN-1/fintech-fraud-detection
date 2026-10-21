require "test_helper"

class MlRiskScorerTest < ActiveSupport::TestCase
  GOLDEN = JSON.parse(File.read(Rails.root.join("test/fixtures/files/ml_golden.json")))

  test "reproduces the probabilities the training run computed for the golden vectors" do
    GOLDEN.each do |row|
      result = MlRiskScorer.score(row["features"])
      assert_in_delta row["probability"], result[:probability], 1e-4
    end
  end

  test "model file and feature builder agree on the feature order" do
    assert_equal 11, MlRiskScorer.model["features"].size
    assert_equal MlRiskScorer.model["features"].size, MlRiskScorer.model["coef"].size
    assert_equal MlRiskScorer::LABELS.keys, MlRiskScorer.model["features"]
  end

  test "explains with at most three reasons, all pushing the risk up, largest first" do
    risky = [ 11.5, 3.9, 0.0, 1.6, 2.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0 ]
    reasons = MlRiskScorer.score(risky)[:reasons]

    assert_operator reasons.size, :<=, 3
    assert reasons.all? { |r| r[:contribution] > 0 }
    assert_equal reasons.map { |r| r[:contribution] }.sort.reverse, reasons.map { |r| r[:contribution] }
  end

  test "a risky vector scores above the flag threshold and a calm one below it" do
    risky = [ 11.5, 3.9, 0.0, 1.6, 2.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0 ]
    calm = [ 5.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 ]

    assert MlRiskScorer.score(risky)[:flag]
    assert_not MlRiskScorer.score(calm)[:flag]
  end

  test "returns nil when switched off" do
    ENV["ML_SCORE_ENABLED"] = "false"
    assert_nil MlRiskScorer.score(GOLDEN.first["features"])
  ensure
    ENV.delete("ML_SCORE_ENABLED")
  end

  test "returns nil instead of raising when the vector does not fit the model" do
    assert_nil MlRiskScorer.score([ 1.0 ])
  end
end
