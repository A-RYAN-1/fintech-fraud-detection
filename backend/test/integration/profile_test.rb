require "test_helper"

class ProfileTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
    @reviewer = users(:reviewer)
  end

  def login_as(user, password: "password123")
    post api_v1_auth_login_url, params: { email: user.email, password: password }
    assert_response :success
  end

  def body
    JSON.parse(response.body)
  end

  def demo_user(email, role)
    User.create!(email: email, first_name: "Judge", last_name: "Demo", role: role, password: "password123")
  end

  test "me returns the decision limit, member since and the demo flag" do
    login_as @reviewer
    get api_v1_auth_me_url
    data = body["data"]
    assert_equal 1000.0, data["decision_limit"]
    assert_not_nil data["created_at"]
    assert_equal false, data["demo_account"]

    login_as users(:admin)
    get api_v1_auth_me_url
    assert_nil body["data"]["decision_limit"]
  end

  test "a person changes their own name and the change is audit-logged" do
    login_as @customer
    assert_difference("AuditLog.count", 1) do
      patch api_v1_auth_me_url, params: { first_name: " Grace ", last_name: "Hopper", role: "admin", email: "x@y.z" }
    end
    assert_response :success
    @customer.reload
    assert_equal [ "Grace", "Hopper" ], [ @customer.first_name, @customer.last_name ]
    assert @customer.customer?, "role must not be writable from the profile"
    assert_equal "test@example.com", @customer.email
    log = AuditLog.order(:created_at).last
    assert_equal "USER_PROFILE_CHANGED", log.event_type
    assert_equal @customer, log.actor
  end

  test "a blank name is refused and an unchanged name logs nothing" do
    login_as @customer
    patch api_v1_auth_me_url, params: { first_name: "  " }
    assert_response :unprocessable_entity
    assert_equal "Test", @customer.reload.first_name

    assert_no_difference("AuditLog.count") do
      patch api_v1_auth_me_url, params: { first_name: "Test", last_name: "User" }
    end
    assert_response :success
  end

  test "a password change needs the current password and a valid new one" do
    login_as @customer
    patch api_v1_auth_password_url, params: { current_password: "wrong-one", password: "newpassword1", password_confirmation: "newpassword1" }
    assert_response :unprocessable_entity
    assert_equal "Current password is wrong", body["message"]

    patch api_v1_auth_password_url, params: { current_password: "password123", password: "short", password_confirmation: "short" }
    assert_response :unprocessable_entity

    patch api_v1_auth_password_url, params: { current_password: "password123", password: "newpassword1", password_confirmation: "other-one1" }
    assert_response :unprocessable_entity

    assert_difference("AuditLog.count", 1) do
      patch api_v1_auth_password_url, params: { current_password: "password123", password: "newpassword1", password_confirmation: "newpassword1" }
    end
    assert_response :success
    assert @customer.reload.authenticate("newpassword1")
    assert_equal "USER_PASSWORD_CHANGED", AuditLog.order(:created_at).last.event_type
    assert_not_includes AuditLog.order(:created_at).last.description, "newpassword1"
  end

  test "the shared demo accounts are read-only" do
    judge = demo_user("judge.reviewer@sentrix.demo", :reviewer)
    login_as judge
    get api_v1_auth_me_url
    assert_equal true, body["data"]["demo_account"]

    patch api_v1_auth_me_url, params: { first_name: "Mallory" }
    assert_response :forbidden
    assert_equal "demo_account", body["error"]
    patch api_v1_auth_password_url, params: { current_password: "password123", password: "takeover123", password_confirmation: "takeover123" }
    assert_response :forbidden
    assert judge.reload.authenticate("password123")
    assert_equal "Judge", judge.first_name
  end

  test "activity lists only this person's newest audit rows" do
    AuditLog.record!(event_type: "REVIEW_NOTE", entity_type: "Transaction", entity_id: 1, description: "mine", actor: @reviewer)
    AuditLog.record!(event_type: "REVIEW_NOTE", entity_type: "Transaction", entity_id: 2, description: "someone else", actor: users(:admin))
    login_as @reviewer
    get api_v1_auth_activity_url
    assert_response :success
    assert_equal [ "mine" ], body["data"]["activity"].map { |a| a["description"] }
  end

  test "profile endpoints need a session" do
    get api_v1_auth_activity_url
    assert_response :unauthorized
    patch api_v1_auth_me_url, params: { first_name: "X" }
    assert_response :unauthorized
  end
end
