class AddLabelsToFraudEvaluations < ActiveRecord::Migration[8.1]
  # A human decision on a payment is the label the automatic signals are scored against. `ml_features` keeps the vector the
  # model saw at scoring time, so the labels can later be used for training without recomputing history.
  def change
    add_column :fraud_evaluations, :ml_features, :jsonb
    add_column :fraud_evaluations, :human_label, :string
    add_column :fraud_evaluations, :label_source, :string
    add_column :fraud_evaluations, :labeled_at, :datetime
    add_reference :fraud_evaluations, :labeled_by, foreign_key: { to_table: :users, on_delete: :nullify }
    add_index :fraud_evaluations, :human_label
  end
end
