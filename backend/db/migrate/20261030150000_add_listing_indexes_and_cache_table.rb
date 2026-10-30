# Indexes for the two lists that read newest first (a customer's payments, the review queue) so the database walks the
# index in order and stops at the page size, and the table solid_cache keeps the analytics numbers in (PG-3).
# The single-column user_id index is the prefix of the new one, so it goes.
class AddListingIndexesAndCacheTable < ActiveRecord::Migration[8.1]
  def change
    add_index :transactions, [ :user_id, :created_at, :id ], order: { created_at: :desc, id: :desc },
              name: "index_transactions_on_user_id_and_created_at_and_id"
    add_index :transactions, [ :paypal_status, :created_at, :id ], order: { created_at: :desc, id: :desc },
              name: "index_transactions_on_paypal_status_and_created_at_and_id"
    remove_index :transactions, :user_id, name: "index_transactions_on_user_id"

    create_table :solid_cache_entries do |t|
      t.binary :key, limit: 1024, null: false
      t.binary :value, limit: 536_870_912, null: false
      t.datetime :created_at, null: false
      t.integer :key_hash, limit: 8, null: false
      t.integer :byte_size, limit: 4, null: false
      t.index :byte_size
      t.index [ :key_hash, :byte_size ]
      t.index :key_hash, unique: true
    end
  end
end
