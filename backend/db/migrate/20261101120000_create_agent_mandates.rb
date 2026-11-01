class CreateAgentMandates < ActiveRecord::Migration[8.1]
  def change
    create_table :agent_mandates do |t|
      t.references :user, null: false, foreign_key: true
      t.string :label, null: false
      t.string :merchant, null: false
      t.decimal :per_payment_cap, precision: 12, scale: 2, null: false
      t.decimal :total_cap, precision: 12, scale: 2, null: false
      t.decimal :spent_amount, precision: 12, scale: 2, null: false, default: 0
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.bigint :revoked_by_id
      t.datetime :last_used_at
      t.string :token_digest, null: false
      t.string :token_hint, null: false
      t.timestamps
    end
    add_index :agent_mandates, :token_digest, unique: true

    add_reference :transactions, :agent_mandate, null: true, foreign_key: true, index: true
  end
end
