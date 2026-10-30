# Protects the payment request from the AI analyst. Two guards in front of every Gemini call:
#   - a token bucket: at most `capacity` calls in a burst, refilled at `refill_per_minute` (sized under the free
#     tier's per-minute quota), so a traffic spike skips the analyst instead of earning 429s;
#   - a circuit breaker: after `failure_threshold` failures in a row the analyst is skipped for `cooldown` seconds,
#     then one probe call is let through (half open); a success closes the circuit, a failure reopens it.
# A skipped call is not an error: the rules and the model decide alone, as when the analyst is switched off.
# State lives in this process (one Render instance), guarded by a mutex; the load test states that limit.
class AnalystGuard
  CLOSED = :closed
  OPEN = :open
  HALF_OPEN = :half_open

  Counters = Struct.new(:calls, :successes, :failures, :retries, :skipped_open, :skipped_rate_limited, keyword_init: true)

  DEFAULTS = { failure_threshold: 5, cooldown: 60.0, capacity: 10, refill_per_minute: 10 }.freeze

  def self.instance
    @instance ||= from_env
  end

  def self.reset!
    @instance = nil
  end

  def self.from_env
    new(failure_threshold: Integer(ENV.fetch("AI_BREAKER_FAILURES", DEFAULTS[:failure_threshold])),
        cooldown: Float(ENV.fetch("AI_BREAKER_COOLDOWN_SECONDS", DEFAULTS[:cooldown])),
        capacity: Integer(ENV.fetch("AI_BUCKET_CAPACITY", DEFAULTS[:capacity])),
        refill_per_minute: Float(ENV.fetch("AI_BUCKET_REFILL_PER_MINUTE", DEFAULTS[:refill_per_minute])))
  end

  def initialize(failure_threshold: DEFAULTS[:failure_threshold], cooldown: DEFAULTS[:cooldown], capacity: DEFAULTS[:capacity],
                 refill_per_minute: DEFAULTS[:refill_per_minute], clock: -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) })
    @failure_threshold = failure_threshold
    @cooldown = cooldown
    @capacity = capacity
    @refill_per_second = refill_per_minute / 60.0
    @clock = clock
    @mutex = Mutex.new
    @state = CLOSED
    @consecutive_failures = 0
    @opened_at = nil
    @probe_in_flight = false
    @tokens = capacity.to_f
    @refilled_at = clock.call
    @counters = Counters.new(calls: 0, successes: 0, failures: 0, retries: 0, skipped_open: 0, skipped_rate_limited: 0)
    @last_failure = nil
    @last_call_at = nil
  end

  # :ok when the call may go ahead, otherwise the reason it is skipped (:circuit_open or :rate_limited).
  def acquire
    @mutex.synchronize do
      if @state == OPEN && @clock.call - @opened_at >= @cooldown
        @state = HALF_OPEN
        @probe_in_flight = false
      end

      if @state == OPEN || (@state == HALF_OPEN && @probe_in_flight)
        @counters.skipped_open += 1
        next :circuit_open
      end

      refill
      if @tokens < 1
        @counters.skipped_rate_limited += 1
        next :rate_limited
      end

      @tokens -= 1
      @probe_in_flight = true if @state == HALF_OPEN
      @counters.calls += 1
      @last_call_at = Time.current
      :ok
    end
  end

  # A retry costs a token too. False when the bucket is empty or the circuit is not closed: do not retry then.
  def acquire_retry
    @mutex.synchronize do
      refill
      next false unless @state == CLOSED && @tokens >= 1

      @tokens -= 1
      @counters.retries += 1
      true
    end
  end

  def success
    @mutex.synchronize do
      @counters.successes += 1
      @consecutive_failures = 0
      @probe_in_flight = false
      @state = CLOSED
    end
  end

  def failure(reason = nil)
    @mutex.synchronize do
      @counters.failures += 1
      @consecutive_failures += 1
      @last_failure = reason.to_s.truncate(120) if reason
      @probe_in_flight = false
      if @state == HALF_OPEN || @consecutive_failures >= @failure_threshold
        @state = OPEN
        @opened_at = @clock.call
      end
    end
  end

  def snapshot
    @mutex.synchronize do
      refill
      remaining = @state == OPEN ? [ @cooldown - (@clock.call - @opened_at), 0 ].max.round(1) : 0
      { state: @state.to_s, consecutive_failures: @consecutive_failures, retry_in_seconds: remaining,
        tokens: @tokens.floor, capacity: @capacity, last_failure: @last_failure, last_call_at: @last_call_at, **@counters.to_h }
    end
  end

  private

  def refill
    now = @clock.call
    @tokens = [ @capacity.to_f, @tokens + (now - @refilled_at) * @refill_per_second ].min
    @refilled_at = now
  end
end
