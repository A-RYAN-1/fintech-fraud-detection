require "test_helper"

class IncidentScanTest < ActiveSupport::TestCase
  def fail_job(error_class: "RuntimeError", message: "boom")
    job = SolidQueue::Job.create!(queue_name: "default", class_name: "BoomJob", arguments: "{}", active_job_id: SecureRandom.uuid)
    SolidQueue::FailedExecution.create!(job: job, error: { "exception_class" => error_class, "message" => message, "backtrace" => [] })
  end

  test "failed jobs of the same class and error become one incident with a count" do
    2.times { fail_job }
    fail_job(error_class: "Timeout::Error", message: "slow")
    IncidentScan.run
    rows = Incident.where(kind: "job_failed").pluck(:title, :occurrences).sort_by(&:first)
    assert_equal [ [ "Background job BoomJob failed with RuntimeError", 2 ], [ "Background job BoomJob failed with Timeout::Error", 1 ] ], rows
  end

  test "a scan run twice does not double the counts" do
    2.times { fail_job }
    IncidentScan.run
    IncidentScan.run
    assert_equal 2, Incident.find_by(kind: "job_failed").occurrences
  end

  test "analyst failures become an incident, a healthy analyst does not" do
    IncidentScan.run
    assert_nil Incident.find_by(kind: "analyst")
    guard = AnalystGuard.instance
    guard.acquire
    guard.failure("Gemini returned 503")
    IncidentScan.run
    incident = Incident.find_by(kind: "analyst")
    assert_equal 1, incident.occurrences
    assert_equal "Gemini returned 503", incident.detail
  end

  test "the scan job runs it" do
    fail_job
    IncidentScanJob.perform_now
    assert_equal 1, Incident.where(kind: "job_failed").count
  end
end
