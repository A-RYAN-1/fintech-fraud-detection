require "test_helper"

class SupportMessagesTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def body
    JSON.parse(response.body)
  end

  def send_message(**overrides)
    post api_v1_support_messages_url, params: { topic: "payment", subject: "Held payment", message: "Why is it held?" }.merge(overrides)
  end

  test "a message reaches every active admin as a notification and is audit-logged" do
    active_admins = User.where(role: :admin, status: :active)
    assert_operator active_admins.count, :>=, 2
    User.create!(email: "old.admin@example.com", first_name: "Old", last_name: "Admin", role: :admin, status: :suspended, password: "password123")

    login_as @customer
    assert_difference("Notification.count", active_admins.count) do
      assert_difference("AuditLog.count", 1) { send_message }
    end
    assert_response :created
    assert_equal active_admins.count, body["data"]["delivered_to"]

    note = users(:admin).notifications.order(:created_at).last
    assert_equal "support", note.notification_type
    assert_equal "Support (payment): Held payment", note.title
    assert_includes note.message, @customer.email
    assert_includes note.message, "Why is it held?"
    assert_equal @customer.id, note.data["from_user_id"]
    assert_empty @customer.notifications.where(notification_type: "support")
    assert_equal "SUPPORT_MESSAGE_SENT", AuditLog.order(:created_at).last.event_type
  end

  test "topic, subject and message are checked" do
    login_as @customer
    assert_no_difference("Notification.count") do
      send_message(topic: "billing")
      assert_response :unprocessable_entity
      send_message(subject: "   ")
      assert_response :unprocessable_entity
      send_message(message: "x" * 801)
      assert_response :unprocessable_entity
    end
  end

  test "a message needs a session" do
    send_message
    assert_response :unauthorized
  end

  test "a customer is limited to five messages an hour" do
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
    login_as @customer
    5.times { send_message; assert_response :created }
    send_message
    assert_response :too_many_requests
  ensure
    Rack::Attack.cache.store.clear
    Rack::Attack.enabled = false
  end

  test "payment notifications print US dollars" do
    transaction = transactions(:one)
    transaction.update_columns(amount: 1234.5)
    note = Notification.create_transaction_notification(user: @customer, transaction: transaction, status: "FLAGGED")
    assert_includes note.message, "$1,234.50"
    assert_not_includes note.message, "₹"
  end
end
