require "test_helper"

class AnalystGuardTest < ActiveSupport::TestCase
  setup do
    @now = 0.0
    @clock = -> { @now }
  end

  def guard(**options)
    AnalystGuard.new(failure_threshold: 3, cooldown: 30, capacity: 2, refill_per_minute: 60, clock: @clock, **options)
  end

  test "allows calls until the bucket is empty, then skips with rate_limited" do
    g = guard
    assert_equal :ok, g.acquire
    assert_equal :ok, g.acquire
    assert_equal :rate_limited, g.acquire
    assert_equal 1, g.snapshot[:skipped_rate_limited]
  end

  test "the bucket refills with time and never above its capacity" do
    g = guard
    2.times { g.acquire }
    @now += 1.0
    assert_equal :ok, g.acquire
    assert_equal :rate_limited, g.acquire
    @now += 600
    assert_equal 2, g.snapshot[:tokens]
  end

  test "opens after the failure threshold and skips with circuit_open" do
    g = guard(capacity: 10)
    2.times { g.acquire; g.failure("503") }
    assert_equal "closed", g.snapshot[:state]
    g.acquire
    g.failure("503")
    assert_equal "open", g.snapshot[:state]
    assert_equal :circuit_open, g.acquire
    assert_equal 30.0, g.snapshot[:retry_in_seconds]
  end

  test "a success resets the failure streak" do
    g = guard(capacity: 10)
    2.times { g.acquire; g.failure }
    g.acquire
    g.success
    2.times { g.acquire; g.failure }
    assert_equal "closed", g.snapshot[:state]
  end

  test "after the cooldown one probe goes through, a success closes the circuit" do
    g = guard(capacity: 10)
    3.times { g.acquire; g.failure }
    @now += 31
    assert_equal :ok, g.acquire
    assert_equal "half_open", g.snapshot[:state]
    assert_equal :circuit_open, g.acquire, "only one probe at a time"
    g.success
    assert_equal "closed", g.snapshot[:state]
    assert_equal :ok, g.acquire
  end

  test "a failed probe reopens the circuit for another cooldown" do
    g = guard(capacity: 10)
    3.times { g.acquire; g.failure }
    @now += 31
    g.acquire
    g.failure("503")
    assert_equal "open", g.snapshot[:state]
    assert_equal :circuit_open, g.acquire
    @now += 31
    assert_equal :ok, g.acquire
  end

  test "a retry needs a token and a closed circuit" do
    g = guard
    g.acquire
    assert g.acquire_retry
    assert_not g.acquire_retry, "bucket empty"
    assert_equal 1, g.snapshot[:retries]
  end

  test "concurrent callers never take more tokens than the bucket holds" do
    g = AnalystGuard.new(capacity: 5, refill_per_minute: 0, clock: @clock)
    results = Array.new(40) { Thread.new { g.acquire } }.map(&:value)
    assert_equal 5, results.count(:ok)
    assert_equal 35, results.count(:rate_limited)
  end
end
