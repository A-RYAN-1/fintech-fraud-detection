class CreateRiskRuleSettings < ActiveRecord::Migration[8.1]
  # The values RiskRulesProcessor used as constants, so scoring is identical until someone edits a row.
  SEED = {
    "block_threshold" => 70, "flag_threshold" => 30, "first_txn_high_risk" => 30, "high_amount_limit" => 100_000,
    "amount_deviation_high" => 40, "amount_deviation_medium" => 30, "amount_deviation_low" => 20,
    "deviation_multiplier_high" => 10, "deviation_multiplier_medium" => 5, "deviation_multiplier_low" => 2,
    "rapid_velocity_low" => 20, "rapid_velocity_medium" => 30, "rapid_velocity_high" => 40,
    "velocity_window_seconds" => 60, "medium_amount_min" => 1_000, "large_amount_min" => 10_000,
    "very_large_amount_min" => 50_000, "untrusted_device_risk" => 30, "missing_device_risk" => 50
  }.freeze

  def up
    create_table :risk_rule_settings do |t|
      t.string :key, null: false
      t.decimal :value, precision: 14, scale: 2, null: false
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :risk_rule_settings, :key, unique: true

    now = connection.quote(Time.current)
    rows = SEED.map { |key, value| "(#{connection.quote(key)}, #{value}, #{now}, #{now})" }
    execute "INSERT INTO risk_rule_settings (key, value, created_at, updated_at) VALUES #{rows.join(', ')}"
  end

  def down
    drop_table :risk_rule_settings
  end
end
