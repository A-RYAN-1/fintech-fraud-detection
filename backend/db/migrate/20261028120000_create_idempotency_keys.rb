class CreateIdempotencyKeys < ActiveRecord::Migration[8.1]
  # One row per (user, Idempotency-Key): the request fingerprint while the request runs, then the stored response.
  def change
    create_table :idempotency_keys do |t|
      t.references :user, null: false, foreign_key: true
      t.string :key, null: false
      t.string :request_method, null: false
      t.string :request_path, null: false
      t.string :request_fingerprint, null: false
      t.integer :response_status
      t.text :response_body
      t.timestamps
    end
    add_index :idempotency_keys, [ :user_id, :key ], unique: true
    add_index :idempotency_keys, :created_at
  end
end
