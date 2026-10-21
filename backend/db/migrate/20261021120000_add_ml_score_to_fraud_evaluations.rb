class AddMlScoreToFraudEvaluations < ActiveRecord::Migration[8.1]
  def change
    add_column :fraud_evaluations, :ml_score, :float
    add_column :fraud_evaluations, :ml_version, :string
    add_column :fraud_evaluations, :ml_explanation, :jsonb
  end
end
