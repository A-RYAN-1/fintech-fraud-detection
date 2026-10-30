require "test_helper"

class AnalyticsCacheTest < ActiveSupport::TestCase
  setup do
    @original = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
  end

  teardown { Rails.cache = @original }

  test "the block runs once while nothing changes" do
    calls = 0
    2.times { AnalyticsCache.fetch("insights", "7d") { calls += 1 } }
    assert_equal 1, calls
  end

  test "different parts are different entries" do
    assert_equal 1, AnalyticsCache.fetch("spending", 1, "7d") { 1 }
    assert_equal 2, AnalyticsCache.fetch("spending", 2, "7d") { 2 }
  end

  test "a new payment makes the next read recompute" do
    calls = 0
    AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    users(:one).transactions.create!(amount: 5, device_id: "d")
    AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    assert_equal 2, calls
  end

  test "a changed evaluation makes the next read recompute" do
    t = users(:one).transactions.create!(amount: 5, device_id: "d")
    calls = 0
    AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    FraudEvaluation.create!(financial_transaction: t, risk_score: 1)
    AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    assert_equal 2, calls
  end

  test "an entry expires after 60 seconds" do
    calls = 0
    AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    travel 61.seconds do
      AnalyticsCache.fetch("insights", "7d") { calls += 1 }
    end
    assert_equal 2, calls
  end

  test "a cache that raises is skipped and the numbers are still computed" do
    broken = Object.new
    def broken.fetch(*) = raise("cache down")
    Rails.cache = broken
    assert_equal 42, AnalyticsCache.fetch("insights", "7d") { 42 }
  end
end
