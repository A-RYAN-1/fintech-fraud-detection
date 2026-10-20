require "test_helper"

class TransactionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    # Login manually by setting session
    post api_v1_auth_login_url, params: { email: @user.email, password: 'password123' }
  end

  test "should get index" do
    get api_v1_transactions_url
    assert_response :success
    json_response = JSON.parse(response.body)
    assert_equal "success", json_response["status"]
    assert_not_nil json_response["data"]["transactions"]
  end

  test "sorts by amount ascending and descending" do
    get api_v1_transactions_url, params: { sort_by: "amount", sort_order: "asc" }
    assert_response :success
    assert_equal [ 100.0, 500.0 ], listed_amounts

    get api_v1_transactions_url, params: { sort_by: "amount", sort_order: "desc" }
    assert_equal [ 500.0, 100.0 ], listed_amounts
  end

  test "an unknown sort column falls back to newest first" do
    get api_v1_transactions_url, params: { sort_by: "amount; DROP TABLE transactions", sort_order: "asc; --" }
    assert_response :success
    assert_equal [ 100.0, 500.0 ], listed_amounts
    assert Transaction.count.positive?
  end

  test "should create transaction" do
    assert_difference("Transaction.count") do
      post api_v1_transactions_url, params: { 
        transaction: { 
          amount: 500, 
          payment_method: "upi", 
          device_id: "test_device" 
        } 
      }
    end
    assert_response :created
  end

  test "should fail without device_id" do
    post api_v1_transactions_url, params: { 
      transaction: { 
        amount: 500, 
        payment_method: "card" 
      } 
    }
    assert_response :unprocessable_entity
  end

  private

  def listed_amounts
    JSON.parse(response.body)["data"]["transactions"].map { |t| t["amount"].to_f }
  end
end
