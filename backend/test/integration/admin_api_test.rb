require "test_helper"

class AdminApiTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @reviewer = users(:reviewer)
    @customer = users(:one)
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def body
    JSON.parse(response.body)
  end

  # Access control

  test "admin routes require a session" do
    get api_v1_admin_users_url
    assert_response :unauthorized
    get api_v1_admin_audit_logs_url
    assert_response :unauthorized
  end

  test "a customer cannot reach any admin route" do
    login_as @customer
    get api_v1_admin_users_url
    assert_response :forbidden
    get api_v1_admin_audit_logs_url
    assert_response :forbidden
    patch status_api_v1_admin_user_url(@reviewer), params: { status: "suspended" }
    assert_response :forbidden
    assert @reviewer.reload.active?
  end

  test "a reviewer can list users but not change them or read audit logs" do
    login_as @reviewer
    get api_v1_admin_users_url
    assert_response :success
    get api_v1_admin_audit_logs_url
    assert_response :forbidden
    patch role_api_v1_admin_user_url(@customer), params: { role: "admin" }
    assert_response :forbidden
    assert @customer.reload.customer?
  end

  # Users list

  test "users list has the shape the frontend reads" do
    login_as @admin
    get api_v1_admin_users_url
    data = body["data"]
    assert_equal User.count, data["pagination"]["total_count"]
    assert_equal 1, data["pagination"]["current_page"]
    user = data["users"].first
    assert_equal %w[created_at decision_limit email first_name id last_name role status], user.keys.sort
    assert_not_includes user.keys, "password_digest"
  end

  test "users list filters by role, status and search, and paginates" do
    login_as @admin
    get api_v1_admin_users_url, params: { role: "admin" }
    assert_equal [ "admin@example.com" ], body["data"]["users"].map { |u| u["email"] }

    get api_v1_admin_users_url, params: { status: "suspended" }
    assert_equal [ "suspended@example.com" ], body["data"]["users"].map { |u| u["email"] }

    get api_v1_admin_users_url, params: { search: "Rev" }
    assert_equal [ "reviewer@example.com" ], body["data"]["users"].map { |u| u["email"] }

    get api_v1_admin_users_url, params: { per_page: 2, page: 2 }
    assert_equal 2, body["data"]["pagination"]["current_page"]
    assert_equal (User.count / 2.0).ceil, body["data"]["pagination"]["total_pages"]
    assert_equal [ User.count - 2, 2 ].min, body["data"]["users"].size
  end

  test "search treats percent as a literal character" do
    login_as @admin
    get api_v1_admin_users_url, params: { search: "%" }
    assert_empty body["data"]["users"]
  end

  test "an unknown role or status filter is rejected" do
    login_as @admin
    get api_v1_admin_users_url, params: { role: "root" }
    assert_response :unprocessable_entity
    get api_v1_admin_users_url, params: { status: "gone" }
    assert_response :unprocessable_entity
  end

  # Changing users

  test "admin suspends a user and the change is audit-logged" do
    login_as @admin
    assert_difference("AuditLog.count", 1) do
      patch status_api_v1_admin_user_url(@customer), params: { status: "suspended" }
    end
    assert_response :success
    assert_equal "suspended", body["data"]["status"]
    assert @customer.reload.suspended?

    log = AuditLog.order(:created_at).last
    assert_equal "USER_STATUS_CHANGED", log.event_type
    assert_equal "User", log.entity_type
    assert_equal @customer.id.to_s, log.entity_id
    assert_includes log.description, "from active to suspended"
    assert_includes log.description, @admin.email
  end

  test "admin changes a role and the change is audit-logged" do
    login_as @admin
    patch role_api_v1_admin_user_url(@customer), params: { role: "reviewer" }
    assert_response :success
    assert @customer.reload.reviewer?
    assert_equal "USER_ROLE_CHANGED", AuditLog.order(:created_at).last.event_type
  end

  test "setting the value a user already has changes nothing and logs nothing" do
    login_as @admin
    assert_no_difference("AuditLog.count") do
      patch role_api_v1_admin_user_url(@customer), params: { role: "customer" }
    end
    assert_response :success
  end

  test "an invalid role or status is rejected without a change" do
    login_as @admin
    patch role_api_v1_admin_user_url(@customer), params: { role: "root" }
    assert_response :unprocessable_entity
    patch status_api_v1_admin_user_url(@customer), params: {}
    assert_response :unprocessable_entity
    assert @customer.reload.customer?
    assert @customer.active?
  end

  test "an admin cannot change their own role or status" do
    login_as @admin
    patch role_api_v1_admin_user_url(@admin), params: { role: "customer" }
    assert_response :unprocessable_entity
    patch status_api_v1_admin_user_url(@admin), params: { status: "suspended" }
    assert_response :unprocessable_entity
    assert @admin.reload.admin?
    assert @admin.active?
  end

  test "an unknown user id returns 404" do
    login_as @admin
    patch role_api_v1_admin_user_url(id: 0), params: { role: "admin" }
    assert_response :not_found
  end

  test "a suspended user's open session ends on the next request" do
    login_as @customer
    get api_v1_notifications_url
    assert_response :success

    @customer.update!(status: :suspended)
    get api_v1_notifications_url
    assert_response :forbidden
    get api_v1_auth_me_url
    assert_response :unauthorized
  end

  # Audit logs

  test "audit logs list newest first with the shape the frontend reads" do
    AuditLog.create!(event_type: "TRANSACTION_BLOCKED", entity_type: "Transaction", entity_id: "t1",
                     description: "older", created_at: 2.days.ago)
    AuditLog.create!(event_type: "USER_ROLE_CHANGED", entity_type: "User", entity_id: "9",
                     description: "newer", created_at: 1.day.ago)
    login_as @admin
    get api_v1_admin_audit_logs_url
    data = body["data"]
    assert_equal 2, data["pagination"]["total_count"]
    assert_equal %w[newer older], data["audit_logs"].map { |l| l["description"] }
    assert_equal %w[actor actor_role after before created_at description entity_id entity_type event_type id reason], data["audit_logs"].first.keys.sort
  end

  test "audit logs filter by event type and entity type" do
    AuditLog.create!(event_type: "TRANSACTION_BLOCKED", entity_type: "Transaction", entity_id: "t1", description: "a")
    AuditLog.create!(event_type: "USER_ROLE_CHANGED", entity_type: "User", entity_id: "9", description: "b")
    login_as @admin

    get api_v1_admin_audit_logs_url, params: { event_type: "USER_ROLE_CHANGED" }
    assert_equal %w[b], body["data"]["audit_logs"].map { |l| l["description"] }

    get api_v1_admin_audit_logs_url, params: { entity_type: "Transaction" }
    assert_equal %w[a], body["data"]["audit_logs"].map { |l| l["description"] }
  end

  test "per_page is capped at 100" do
    login_as @admin
    get api_v1_admin_users_url, params: { per_page: 5000 }
    assert_response :success
    assert_operator body["data"]["users"].size, :<=, 100
  end
end
