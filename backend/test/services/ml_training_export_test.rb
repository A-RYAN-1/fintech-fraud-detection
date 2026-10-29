require "test_helper"

class MlTrainingExportTest < ActiveSupport::TestCase
  setup { RiskRuleConfig.reset_cache! }

  def run_traffic(**options)
    replace_class_method(PaypalClient, :new, ->(*) { raise "PayPal must not be called" }) do
      DemoTraffic.new(**{ seed: 7, customers: 12, days: 7, leave_open: 0, rings: 2 }.merge(options)).run
    end
  end

  test "only human-decided evaluations with stored features are exported, as block or approve" do
    run_traffic
    rows = MlTrainingExport.rows

    assert_equal FraudEvaluation.where.not(human_label: nil).where.not(ml_features: nil).count, rows.size
    assert_equal [ 0, 1 ], rows.map { |row| row[:label] }.uniq.sort
    assert rows.all? { |row| row[:features].size == MlRiskScorer.model["features"].size }
    assert rows.all? { |row| row[:ml_version] == MlRiskScorer.model["version"] }
  end

  test "rows carry no identifiers and the key is stable between exports" do
    run_traffic
    first = MlTrainingExport.rows

    assert_equal %i[features label ml_score ml_version row_key rules_score], first.first.keys.sort
    assert_equal first.map { |row| row[:row_key] }, MlTrainingExport.rows.map { |row| row[:row_key] }
    assert_equal first.size, first.map { |row| row[:row_key] }.uniq.size
  end

  test "payments nobody has decided are not exported" do
    run_traffic(leave_open: 3)
    assert_equal 0, MlTrainingExport.rows.size - FraudEvaluation.where.not(human_label: nil).count
    assert_operator FraudEvaluation.where(human_label: nil).count, :>, 0
  end
end
