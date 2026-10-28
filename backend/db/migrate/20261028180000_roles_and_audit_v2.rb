class RolesAndAuditV2 < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :decision_limit, :decimal, precision: 12, scale: 2

    add_reference :audit_logs, :actor, foreign_key: { to_table: :users, on_delete: :nullify }, index: true
    add_column :audit_logs, :actor_role, :string
    add_column :audit_logs, :before_state, :jsonb
    add_column :audit_logs, :after_state, :jsonb
    add_column :audit_logs, :reason, :string
  end
end
