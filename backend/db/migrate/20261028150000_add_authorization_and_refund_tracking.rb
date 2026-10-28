class AddAuthorizationAndRefundTracking < ActiveRecord::Migration[8.1]
  # When PayPal authorized the payment and when that authorization lapses, and how much has been refunded so far.
  def change
    add_column :transactions, :paypal_authorized_at, :datetime
    add_column :transactions, :paypal_authorization_expires_at, :datetime
    add_column :transactions, :refunded_amount, :decimal, precision: 12, scale: 2, default: 0, null: false
    add_index :transactions, [ :paypal_status, :paypal_authorization_expires_at ], name: "index_transactions_on_status_and_authorization_expiry"
  end
end
