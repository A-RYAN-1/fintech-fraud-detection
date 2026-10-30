require "test_helper"

class IncidentLogTest < ActiveSupport::TestCase
  Failure = Struct.new(:message, :status, :debug_id, :issue)

  def paypal_failure(status: 502, message: "Bad gateway")
    Failure.new(message, status, "dbg-1", nil)
  end

  test "the first failure creates an incident and the same failure again counts it" do
    IncidentLog.paypal_error(paypal_failure, action: "capture", payment_id: "p1")
    IncidentLog.paypal_error(paypal_failure, action: "capture", payment_id: "p2")
    assert_equal 1, Incident.count
    incident = Incident.last
    assert_equal 2, incident.occurrences
    assert_equal "PayPal capture failed (HTTP 502)", incident.title
    assert_equal "p2", incident.sample["payment_id"]
    assert_equal "dbg-1", incident.sample["debug_id"]
    assert_operator incident.last_seen_at, :>=, incident.first_seen_at
  end

  test "different actions or statuses are different incidents" do
    IncidentLog.paypal_error(paypal_failure, action: "capture")
    IncidentLog.paypal_error(paypal_failure, action: "void")
    IncidentLog.paypal_error(paypal_failure(status: 400), action: "capture")
    assert_equal 3, Incident.count
  end

  test "emails in a message are scrubbed and the detail is cut" do
    IncidentLog.paypal_error(paypal_failure(message: "Payer buyer@example.com declined #{'x' * 500}"), action: "capture")
    detail = Incident.last.detail
    assert_no_match(/buyer@example\.com/, detail)
    assert_includes detail, "[email]"
    assert_operator detail.length, :<=, IncidentLog::MAX_DETAIL
  end

  test "a reported incident that happens again is open again and counts as a recurrence" do
    IncidentLog.paypal_error(paypal_failure, action: "capture")
    Incident.last.update!(status: :reported)
    IncidentLog.paypal_error(paypal_failure, action: "capture")
    incident = Incident.last
    assert incident.open?
    assert_equal 1, incident.recurrences
    assert_equal 2, incident.occurrences
  end

  test "recording a failure never raises, even when the database refuses" do
    replace_class_method(Incident, :create!, ->(*, **) { raise ActiveRecord::StatementInvalid, "boom" }) do
      assert_nothing_raised { IncidentLog.paypal_error(paypal_failure, action: "capture") }
    end
  end

  test "observe sets the count, so scanning twice does not double it, and reopens on growth" do
    now = Time.current
    args = { kind: "job_failed", key: "SomeJob:Boom", title: "Background job SomeJob failed with Boom", first_seen_at: now, last_seen_at: now }
    IncidentLog.observe(**args, count: 3)
    IncidentLog.observe(**args, count: 3)
    incident = Incident.last
    assert_equal 3, incident.occurrences
    incident.update!(status: :dismissed)
    IncidentLog.observe(**args, count: 3)
    assert incident.reload.dismissed?
    IncidentLog.observe(**args, count: 4)
    assert incident.reload.open?
    assert_equal 4, incident.occurrences
    assert_equal 1, incident.recurrences
  end
end
