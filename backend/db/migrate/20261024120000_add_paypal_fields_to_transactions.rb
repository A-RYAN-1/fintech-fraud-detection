class AddPaypalFieldsToTransactions < ActiveRecord::Migration[8.1]
  # A PayPal payment is authorized first, scored, and only then captured, held or voided.
  def change
    add_column :transactions, :paypal_order_id, :string
    add_column :transactions, :paypal_authorization_id, :string
    add_column :transactions, :paypal_capture_id, :string
    add_column :transactions, :paypal_status, :string
    add_index :transactions, :paypal_order_id, unique: true
  end
end
