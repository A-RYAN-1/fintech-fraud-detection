require "test_helper"

class AppealsTest < ActionDispatch::IntegrationTest
  setup do
    @held = users(:one).transactions.create!(amount: 300, payment_method: "wallet", device_id: "d1", status: "FLAGGED", risk_score: 40, paypal_status: "HELD")
    @captured = users(:one).transactions.create!(amount: 20, payment_method: "wallet", device_id: "d1", status: "SUCCESS", paypal_status: "CAPTURED")
    @other = users(:reviewer).transactions.create!(amount: 50, payment_method: "wallet", device_id: "d2", status: "FLAGGED", paypal_status: "HELD")
  end

  def body = JSON.parse(response.body)

  def login(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
  end

  def appeal(transaction, note = "I am travelling and paid from a hotel laptop.")
    post "/api/v1/transactions/#{transaction.id}/appeal", params: { note: note }
  end

  test "requires login" do
    appeal(@held)
    assert_response :unauthorized
  end

  test "a customer sends one note on a held payment and it is saved as an audit row" do
    login(users(:one))
    assert_difference("AuditLog.where(event_type: 'CUSTOMER_APPEAL').count", 1) { appeal(@held) }
    assert_response :created
    log = AuditLog.where(event_type: "CUSTOMER_APPEAL").last
    assert_equal @held.id.to_s, log.entity_id
    assert_equal users(:one), log.actor
    assert_equal "I am travelling and paid from a hotel laptop.", log.reason
    assert_equal "HELD", @held.reload.paypal_status, "a note changes nothing about the payment"
  end

  test "a second note on the same payment is refused" do
    login(users(:one))
    appeal(@held)
    assert_no_difference("AuditLog.count") { appeal(@held, "Another note that is long enough.") }
    assert_response :conflict
  end

  test "only a held payment can be answered" do
    login(users(:one))
    assert_no_difference("AuditLog.count") { appeal(@captured) }
    assert_response :conflict
  end

  test "another customer's payment is a 404" do
    login(users(:one))
    assert_no_difference("AuditLog.count") { appeal(@other) }
    assert_response :not_found
  end

  test "a missing or too short note is rejected and a long one is cut" do
    login(users(:one))
    post "/api/v1/transactions/#{@held.id}/appeal"
    assert_response :bad_request
    appeal(@held, "hi")
    assert_response :unprocessable_entity
    appeal(@held, "x" * 600)
    assert_response :created
    assert_equal Api::V1::AppealsController::MAX_NOTE, AuditLog.where(event_type: "CUSTOMER_APPEAL").last.reason.length
  end

  test "the history list tells a held customer what is happening, whether a note can be sent, and the note once sent" do
    login(users(:one))
    get "/api/v1/transactions"
    rows = body.dig("data", "transactions").index_by { |t| t["id"] }
    assert_equal true, rows[@held.id]["can_appeal"]
    assert_match(/A person is reviewing/, rows[@held.id]["customer_message"])
    assert_nil rows[@held.id]["appeal"]
    assert_equal false, rows[@captured.id]["can_appeal"]
    assert_nil rows[@captured.id]["customer_message"]

    appeal(@held)
    get "/api/v1/transactions"
    row = body.dig("data", "transactions").find { |t| t["id"] == @held.id }
    assert_equal false, row["can_appeal"]
    assert_equal "I am travelling and paid from a hotel laptop.", row.dig("appeal", "note")
  end

  test "the customer message names no rule, score or signal" do
    Appeal::MESSAGES.each_value do |message|
      assert_no_match(/rule|score|risk|fraud|device|model|AI/i, message)
    end
  end

  test "a reviewer sees the customer's note with the other notes on the case" do
    login(users(:one))
    appeal(@held)
    delete api_v1_auth_logout_url
    login(users(:reviewer))
    get "/api/v1/admin/review_queue"
    held = body.dig("data", "held").find { |h| h["id"] == @held.id }
    note = held["notes"].find { |n| n["event_type"] == "CUSTOMER_APPEAL" }
    assert_equal "I am travelling and paid from a hotel laptop.", note["text"]
    assert_equal "customer", note["role"]
  end
end
