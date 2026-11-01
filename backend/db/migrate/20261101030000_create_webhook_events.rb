class CreateWebhookEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :webhook_events do |t|
      t.string :event_id, null: false
      t.string :event_type, null: false
      t.string :resource_id
      t.string :outcome, null: false, default: "received"
      t.string :error
      t.datetime :processed_at
      t.timestamps
    end
    add_index :webhook_events, :event_id, unique: true
    add_index :webhook_events, :created_at
  end
end
