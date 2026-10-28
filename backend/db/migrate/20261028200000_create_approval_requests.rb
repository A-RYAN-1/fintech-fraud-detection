class CreateApprovalRequests < ActiveRecord::Migration[8.1]
  # A decision one person asks for and an admin settles: an approve or void above the requester's limit, and every
  # refund (a refund needs two distinct people). The money moves only when the admin approves.
  def change
    create_table :approval_requests do |t|
      t.references :payment, type: :uuid, null: false, foreign_key: { to_table: :transactions }
      t.string :action, null: false
      t.decimal :amount, precision: 12, scale: 2
      t.string :reason
      t.string :status, null: false, default: "pending"
      t.references :requested_by, null: false, foreign_key: { to_table: :users }
      t.references :decided_by, foreign_key: { to_table: :users }
      t.datetime :decided_at
      t.string :decision_note
      t.timestamps
    end
    add_index :approval_requests, [ :payment_id, :action ], unique: true, where: "status = 'pending'", name: "index_approval_requests_one_pending"
    add_index :approval_requests, :status
  end
end
