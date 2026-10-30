class CreateRuleProposals < ActiveRecord::Migration[8.1]
  # A change to one risk rule that the agent drafted after a person overrode the rules. The agent never edits live rules:
  # the row holds the draft and its backtest, and only an admin accepting it writes risk_rule_settings.
  def change
    create_table :rule_proposals do |t|
      t.string :key, null: false
      t.decimal :current_value, precision: 14, scale: 2, null: false
      t.decimal :proposed_value, precision: 14, scale: 2, null: false
      t.string :trigger_kind, null: false
      t.references :source_payment, type: :uuid, foreign_key: { to_table: :transactions, on_delete: :nullify }
      t.text :rationale, null: false
      t.jsonb :backtest, null: false, default: {}
      t.string :status, null: false, default: "pending"
      t.references :decided_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :decided_at
      t.string :decision_note
      t.timestamps
    end
    add_index :rule_proposals, :status
    add_index :rule_proposals, [ :key, :proposed_value ], unique: true, where: "status = 'pending'", name: "index_rule_proposals_one_pending"
  end
end
