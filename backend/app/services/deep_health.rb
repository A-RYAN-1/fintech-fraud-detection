# What the deep health endpoint reports: the database (with the time one query takes), the job queue (worker
# heartbeats and the backlog of ready jobs) and the AI analyst (configured, circuit state, last call).
# Only the database decides the HTTP status: with it down the API cannot serve anything. A queue with no live
# worker or an open analyst circuit shows as "degraded" (the rules and the model still decide payments).
class DeepHealth
  WORKER_FRESH_FOR = 2.minutes

  def self.call
    new.call
  end

  def call
    database = check_database
    queue = check_queue
    analyst = check_analyst
    status = if database[:status] != "up" then "down"
    elsif queue[:status] != "up" then "degraded"
    else "ok"
    end
    { status: status, timestamp: Time.current, environment: Rails.env, database: database, queue: queue, analyst: analyst }
  end

  private

  def check_database
    started = monotonic
    ActiveRecord::Base.connection.execute("SELECT 1")
    { status: "up", latency_ms: elapsed_ms(started) }
  rescue StandardError => e
    { status: "down", error: e.class.name }
  end

  def check_queue
    started = monotonic
    workers = SolidQueue::Process.where(kind: "Worker").where("last_heartbeat_at > ?", WORKER_FRESH_FOR.ago).count
    ready = SolidQueue::ReadyExecution.count
    oldest = SolidQueue::ReadyExecution.minimum(:created_at)
    { status: workers.positive? ? "up" : "no_worker", workers: workers, ready_jobs: ready,
      oldest_ready_seconds: oldest ? (Time.current - oldest).round : 0, latency_ms: elapsed_ms(started) }
  rescue StandardError => e
    { status: "unavailable", error: e.class.name }
  end

  def check_analyst
    snapshot = AnalystGuard.instance.snapshot
    { enabled: AiAnalyst.enabled?, circuit: snapshot[:state], last_call_at: snapshot[:last_call_at],
      last_failure: snapshot[:last_failure] }
  end

  def monotonic
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end

  def elapsed_ms(started)
    ((monotonic - started) * 1000).round(1)
  end
end
