# Reads the failures that are not recorded as they happen: background jobs that ended in an error (Solid Queue keeps
# them) and the AI analyst's own counters. Safe to run any number of times (IncidentLog.observe sets counts).
module IncidentScan
  def self.run
    (scan_failed_jobs + scan_analyst).compact.size
  end

  def self.scan_failed_jobs
    failures = SolidQueue::FailedExecution.includes(:job).group_by { |failure| [ failure.job.class_name, failure.exception_class ] }
    failures.map do |(job_class, error_class), rows|
      IncidentLog.observe(kind: "job_failed", key: "#{job_class}:#{error_class}", count: rows.size,
                          title: "Background job #{job_class} failed with #{error_class}",
                          first_seen_at: rows.map(&:created_at).min, last_seen_at: rows.map(&:created_at).max,
                          detail: rows.max_by(&:created_at).message, sample: { job: job_class, error: error_class })
    end
  rescue StandardError => e
    Rails.logger.warn(event: "incident_scan_error", part: "jobs", error: e.class.name)
    []
  end

  def self.scan_analyst
    snapshot = AnalystGuard.instance.snapshot
    return [] if snapshot[:failures].zero?

    now = Time.current
    [ IncidentLog.observe(kind: "analyst", key: "gemini_calls", count: snapshot[:failures], first_seen_at: now, last_seen_at: now,
                          title: "AI analyst calls are failing", detail: snapshot[:last_failure],
                          sample: { circuit: snapshot[:state], failures: snapshot[:failures], skipped_open: snapshot[:skipped_open],
                                    skipped_rate_limited: snapshot[:skipped_rate_limited] }) ]
  end
  private_class_method :scan_failed_jobs, :scan_analyst
end
