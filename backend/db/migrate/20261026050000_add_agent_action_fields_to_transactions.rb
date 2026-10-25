class AddAgentActionFieldsToTransactions < ActiveRecord::Migration[8.1]
  # Which actor moved the money (the automatic policy or a human), when, why, and the refund id.
  def change
    add_column :transactions, :paypal_refund_id, :string
    add_column :transactions, :paypal_captured_at, :datetime
    add_column :transactions, :paypal_capture_mode, :string
    add_column :transactions, :paypal_action_reason, :string
    add_index :transactions, :paypal_status
    add_index :transactions, [ :paypal_capture_mode, :paypal_captured_at ]
  end
end
