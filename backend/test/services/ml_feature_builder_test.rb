require "test_helper"

class MlFeatureBuilderTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @stats = user_transaction_stats(:one)
    @device = devices(:one)
  end

  def build(attrs = {})
    transaction = Transaction.create!({ amount: 100, payment_method: "card", device_id: @device.device_id, user: @user, ip_address: "10.0.0.1" }.merge(attrs))
    [ transaction, MlFeatureBuilder.new(transaction, @user, @stats).vector ]
  end

  def feature(vector, name)
    vector[MlRiskScorer.model["features"].index(name)]
  end

  test "amount features use the user's average" do
    _, vector = build(amount: 500)

    assert_in_delta Math.log(1 + 500), feature(vector, "log_amount"), 1e-9
    assert_in_delta Math.log(1 + 5.0), feature(vector, "log_amount_ratio"), 1e-9
  end

  test "the ratio is capped" do
    _, vector = build(amount: 1_000_000)

    assert_in_delta Math.log(1 + 50.0), feature(vector, "log_amount_ratio"), 1e-9
  end

  test "payment method is one-hot with card as the baseline" do
    _, vector = build(payment_method: "upi")

    assert_equal 1.0, feature(vector, "pay_upi")
    assert_equal 0.0, feature(vector, "pay_wallet")
  end

  test "an IP the user has used before is not new" do
    build(ip_address: "10.0.0.7")
    _, seen = build(ip_address: "10.0.0.7")
    _, unseen = build(ip_address: "10.0.0.8")

    assert_equal 0.0, feature(seen, "new_ip")
    assert_equal 1.0, feature(unseen, "new_ip")
  end

  test "the scored transaction does not count towards its own velocity" do
    already = @user.transactions.where("created_at > ?", 1.minute.ago).count
    _, first = build
    build
    _, third = build

    assert_in_delta Math.log(1 + already), feature(first, "log_txns_1m"), 1e-9
    assert_in_delta Math.log(1 + already + 2), feature(third, "log_txns_1m"), 1e-9
  end

  test "an unknown device is untrusted" do
    _, vector = build(device_id: "somebody_elses_phone")

    assert_equal 1.0, feature(vector, "untrusted_device")
  end

  test "the night flag follows the UTC hour of the transaction" do
    travel_to Time.utc(2026, 10, 21, 3, 0) do
      _, vector = build
      assert_equal 1.0, feature(vector, "night")
    end
    travel_to Time.utc(2026, 10, 21, 14, 0) do
      _, vector = build
      assert_equal 0.0, feature(vector, "night")
    end
  end
end
