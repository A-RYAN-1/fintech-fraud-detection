class AddAiVerdictToFraudEvaluations < ActiveRecord::Migration[8.1]
  def change
    add_column :fraud_evaluations, :ai_verdict, :jsonb
  end
end
