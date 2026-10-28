# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_28_180000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.string "entity_id", null: false
    t.string "entity_type", null: false
    t.string "event_type", null: false
    t.datetime "updated_at", null: false
    t.bigint "actor_id"
    t.string "actor_role"
    t.jsonb "before_state"
    t.jsonb "after_state"
    t.string "reason"
    t.index ["actor_id"], name: "index_audit_logs_on_actor_id"
    t.index ["entity_type", "entity_id"], name: "index_audit_logs_on_entity_type_and_entity_id"
    t.index ["event_type"], name: "index_audit_logs_on_event_type"
  end

  create_table "devices", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "device_id", null: false
    t.datetime "first_seen_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "device_id"], name: "index_devices_on_user_id_and_device_id", unique: true
    t.index ["user_id"], name: "index_devices_on_user_id"
  end

  create_table "fraud_evaluations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "is_accurate"
    t.integer "risk_score", null: false
    t.text "rules_triggered"
    t.uuid "transaction_id", null: false
    t.datetime "updated_at", null: false
    t.text "user_feedback"
    t.float "ml_score"
    t.string "ml_version"
    t.jsonb "ml_explanation"
    t.jsonb "ai_verdict"
    t.index ["is_accurate"], name: "index_fraud_evaluations_on_is_accurate"
    t.index ["transaction_id"], name: "index_fraud_evaluations_on_transaction_id"
  end

  create_table "idempotency_keys", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "key", null: false
    t.string "request_method", null: false
    t.string "request_path", null: false
    t.string "request_fingerprint", null: false
    t.integer "response_status"
    t.text "response_body"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_idempotency_keys_on_created_at"
    t.index ["user_id", "key"], name: "index_idempotency_keys_on_user_id_and_key", unique: true
    t.index ["user_id"], name: "index_idempotency_keys_on_user_id"
  end

  create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "data", default: {}
    t.datetime "deleted_at"
    t.text "message", null: false
    t.string "notification_type", default: "transaction", null: false
    t.string "priority", default: "low", null: false
    t.boolean "read", default: false, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["deleted_at"], name: "index_notifications_on_deleted_at"
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id", "read"], name: "index_notifications_on_user_id_and_read"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "risk_rule_settings", force: :cascade do |t|
    t.string "key", null: false
    t.decimal "value", precision: 14, scale: 2, null: false
    t.bigint "updated_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_risk_rule_settings_on_key", unique: true
    t.index ["updated_by_id"], name: "index_risk_rule_settings_on_updated_by_id"
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.datetime "created_at", null: false
    t.string "device_id"
    t.string "ip_address"
    t.string "payment_method", default: "card"
    t.integer "risk_score", default: 0
    t.string "status", default: "PENDING", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "paypal_order_id"
    t.string "paypal_authorization_id"
    t.string "paypal_capture_id"
    t.string "paypal_status"
    t.string "paypal_refund_id"
    t.datetime "paypal_captured_at"
    t.string "paypal_capture_mode"
    t.string "paypal_action_reason"
    t.datetime "paypal_authorized_at"
    t.datetime "paypal_authorization_expires_at"
    t.decimal "refunded_amount", precision: 12, scale: 2, default: "0.0", null: false
    t.index ["created_at"], name: "index_transactions_on_created_at"
    t.index ["payment_method"], name: "index_transactions_on_payment_method"
    t.index ["paypal_capture_mode", "paypal_captured_at"], name: "idx_on_paypal_capture_mode_paypal_captured_at_f007a0c7db"
    t.index ["paypal_order_id"], name: "index_transactions_on_paypal_order_id", unique: true
    t.index ["paypal_status", "paypal_authorization_expires_at"], name: "index_transactions_on_status_and_authorization_expiry"
    t.index ["paypal_status"], name: "index_transactions_on_paypal_status"
    t.index ["risk_score"], name: "index_transactions_on_risk_score"
    t.index ["status"], name: "index_transactions_on_status"
    t.index ["user_id"], name: "index_transactions_on_user_id"
  end

  create_table "user_transaction_stats", force: :cascade do |t|
    t.decimal "avg_amount", precision: 15, scale: 2, default: "0.0", null: false
    t.datetime "created_at", null: false
    t.datetime "last_updated_at"
    t.decimal "total_amount", precision: 18, scale: 2, default: "0.0", null: false
    t.integer "total_txns", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_user_transaction_stats_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "password_digest", null: false
    t.integer "role", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.decimal "decision_limit", precision: 12, scale: 2
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "audit_logs", "users", column: "actor_id", on_delete: :nullify
  add_foreign_key "devices", "users"
  add_foreign_key "fraud_evaluations", "transactions"
  add_foreign_key "idempotency_keys", "users"
  add_foreign_key "notifications", "users"
  add_foreign_key "risk_rule_settings", "users", column: "updated_by_id", on_delete: :nullify
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "transactions", "users"
  add_foreign_key "user_transaction_stats", "users"
end
