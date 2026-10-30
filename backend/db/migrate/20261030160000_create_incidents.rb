class CreateIncidents < ActiveRecord::Migration[8.1]
  # Failures grouped by what went wrong (a fingerprint), with a count, so a person reads "PayPal capture failed with 502,
  # 7 times" once instead of seven log lines. The digest drafts the report; only a person approves it. Nothing here
  # changes code, rules or money.
  def change
    create_table :incidents do |t|
      t.string :fingerprint, null: false
      t.string :kind, null: false
      t.string :title, null: false
      t.text :detail
      t.jsonb :sample, null: false, default: {}
      t.integer :occurrences, null: false, default: 1
      t.integer :recurrences, null: false, default: 0
      t.datetime :first_seen_at, null: false
      t.datetime :last_seen_at, null: false
      t.string :status, null: false, default: "open"
      t.text :ai_note
      t.references :decided_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :decided_at
      t.string :decision_note
      t.string :issue_url
      t.timestamps
    end
    add_index :incidents, :fingerprint, unique: true
    add_index :incidents, [ :status, :last_seen_at ]
  end
end
