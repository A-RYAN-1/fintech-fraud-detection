require "test_helper"

# Keyset pages on the customer's payments and the review queue, and a guard that the lists do not query once per row.
class ListingPaginationTest < ActionDispatch::IntegrationTest
  setup do
    @customer = users(:one)
    @customer.transactions.destroy_all
    @base = Time.utc(2026, 10, 1, 12, 0, 0)
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def data = response.parsed_body["data"]

  def payment(minutes, paypal_status: nil)
    t = @customer.transactions.create!(amount: 10 + minutes, device_id: "d", status: "FLAGGED", paypal_status: paypal_status,
                                       paypal_authorization_id: ("AUTH-#{minutes}" if paypal_status), created_at: @base + minutes.minutes)
    FraudEvaluation.create!(financial_transaction: t, risk_score: 30, rules_triggered: "UNTRUSTED_DEVICE")
    t
  end

  def query_count
    count = 0
    counter = ->(*, payload) { count += 1 unless %w[SCHEMA TRANSACTION].include?(payload[:name]) }
    ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { yield }
    count
  end

  test "transactions: keyset pages cover every payment once, newest first" do
    made = Array.new(7) { |i| payment(i) }
    login_as @customer
    seen = []
    cursor = ""
    pages = 0
    loop do
      get api_v1_transactions_url, params: { cursor: cursor, per_page: 3 }
      assert_response :success
      seen.concat(data["transactions"].map { |t| t["id"] })
      cursor = data["pagination"]["next_cursor"]
      pages += 1
      assert_equal 7, data["pagination"]["total_count"]
      break unless data["pagination"]["has_more"]
    end
    assert_equal 3, pages
    assert_nil cursor
    assert_equal made.reverse.map(&:id), seen
  end

  test "transactions: filters still apply in keyset mode" do
    3.times { |i| payment(i) }
    @customer.transactions.create!(amount: 999, device_id: "d", created_at: @base)
    login_as @customer
    get api_v1_transactions_url, params: { cursor: "", min_amount: 900 }
    assert_equal [ 999.0 ], data["transactions"].map { |t| t["amount"].to_f }
  end

  test "transactions: a bad cursor is a 400 and a cursor with another order is a 422" do
    login_as @customer
    get api_v1_transactions_url, params: { cursor: "nonsense" }
    assert_response :bad_request
    get api_v1_transactions_url, params: { cursor: "", sort_by: "amount" }
    assert_response :unprocessable_entity
  end

  test "transactions: numbered pages still work without a cursor" do
    3.times { |i| payment(i) }
    login_as @customer
    get api_v1_transactions_url, params: { page: 2, per_page: 2 }
    assert_response :success
    assert_equal 1, data["transactions"].size
    assert_equal 2, data["pagination"]["total_pages"]
  end

  test "transactions: the query count does not grow with the page size" do
    login_as @customer
    2.times { |i| payment(i) }
    get api_v1_transactions_url, params: { per_page: 50 } # warm anything cached per process
    small = query_count { get api_v1_transactions_url, params: { per_page: 50 } }
    20.times { |i| payment(i + 10) }
    large = query_count { get api_v1_transactions_url, params: { per_page: 50 } }
    assert_equal small, large
  end

  test "review queue: keyset pages, cursor required to stay in order" do
    held = Array.new(5) { |i| payment(i, paypal_status: "HELD") }
    login_as users(:reviewer)
    get "/api/v1/admin/review_queue", params: { cursor: "", per_page: 2 }
    assert_response :success
    ids = data["held"].map { |h| h["id"] }
    meta = data["meta"]
    assert_equal true, meta["has_more"]
    get "/api/v1/admin/review_queue", params: { cursor: meta["next_cursor"], per_page: 2 }
    ids += data["held"].map { |h| h["id"] }
    get "/api/v1/admin/review_queue", params: { cursor: data["meta"]["next_cursor"], per_page: 2 }
    ids += data["held"].map { |h| h["id"] }
    assert_nil data["meta"]["next_cursor"]
    assert_equal held.reverse.map(&:id), ids
  end

  test "review queue: a bad cursor is a 400, numbered pages still work" do
    payment(1, paypal_status: "HELD")
    login_as users(:reviewer)
    get "/api/v1/admin/review_queue", params: { cursor: "nonsense" }
    assert_response :bad_request
    get "/api/v1/admin/review_queue"
    assert_response :success
    assert_equal 1, data["meta"]["total_count"]
  end

  test "review queue: the query count does not grow with the number of held payments" do
    login_as users(:reviewer)
    payment(1, paypal_status: "HELD")
    get "/api/v1/admin/review_queue"
    small = query_count { get "/api/v1/admin/review_queue" }
    8.times { |i| payment(i + 2, paypal_status: "HELD") }
    large = query_count { get "/api/v1/admin/review_queue" }
    assert_equal small, large
  end
end
