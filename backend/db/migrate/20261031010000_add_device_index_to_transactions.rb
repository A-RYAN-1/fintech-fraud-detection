# Account rings look transactions up by device id (AccountRings); without this the lookup scans the table.
class AddDeviceIndexToTransactions < ActiveRecord::Migration[8.0]
  def change
    add_index :transactions, [ :device_id, :user_id ], where: "device_id IS NOT NULL AND device_id <> ''", name: "index_transactions_on_device_id_and_user_id"
  end
end
