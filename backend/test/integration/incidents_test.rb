require "test_helper"

class IncidentsTest < ActionDispatch::IntegrationTest
  class FailingClient
    def capture(_id, **) = raise(PaypalClient::Error.new("Bad gateway for buyer@example.com", status: 502, debug_id: "dbg-77"))
    def void(_id, **) = {}
    def refund(_id, **) = {}
  end

  def login_as(user)
    post api_v1_auth_login_url, params: { email: user.email, password: "password123" }
    assert_response :success
  end

  def data = response.parsed_body["data"]

  def make_incident(**attrs)
    Incident.create!({ fingerprint: "paypal_error:capture:502", kind: "paypal_error", title: "PayPal capture failed (HTTP 502)",
                       detail: "Bad gateway", sample: { "action" => "capture", "status" => 502 }, occurrences: 4,
                       first_seen_at: 2.hours.ago, last_seen_at: 1.hour.ago }.merge(attrs))
  end

  test "requires a session and refuses customers" do
    get "/api/v1/admin/incidents"
    assert_response :unauthorized
    login_as users(:one)
    get "/api/v1/admin/incidents"
    assert_response :forbidden
  end

  test "staff read open incidents with the draft, the link and the digest" do
    make_incident
    login_as users(:analyst)
    get "/api/v1/admin/incidents"
    assert_response :success
    row = data["incidents"].first
    assert_equal 4, row["occurrences"]
    assert_equal "[Sentrix] PayPal capture failed (HTTP 502)", row["draft"]["title"]
    assert_includes row["draft"]["body"], "Seen 4 times"
    assert row["draft"]["new_issue_url"].start_with?("https://github.com/")
    assert_includes data["digest"], "1 open incident, 4 occurrences"
    assert_equal 1, data["open_count"]
    get "/api/v1/admin/incidents", params: { status: "bogus" }
    assert_response :unprocessable_entity
  end

  test "the status filter separates open from reported" do
    make_incident
    make_incident(fingerprint: "job_failed:X:Y", kind: "job_failed", title: "Background job X failed with Y", status: :reported)
    login_as users(:analyst)
    get "/api/v1/admin/incidents", params: { status: "reported" }
    assert_equal [ "Background job X failed with Y" ], data["incidents"].map { |i| i["title"] }
    get "/api/v1/admin/incidents", params: { status: "all" }
    assert_equal 2, data["incidents"].size
  end

  test "only an admin approves; approving marks it reported, audits it and files nothing" do
    incident = make_incident
    login_as users(:reviewer)
    post "/api/v1/admin/incidents/#{incident.id}/approve", headers: { "Idempotency-Key" => "i0" }
    assert_response :forbidden
    delete api_v1_auth_logout_url
    login_as users(:admin)
    assert_difference -> { AuditLog.where(event_type: "INCIDENT_APPROVED").count }, 1 do
      post "/api/v1/admin/incidents/#{incident.id}/approve", params: { note: "filing it", issue_url: "https://github.com/A-RYAN-1/fintech-fraud-detection/issues/99" },
                                                             headers: { "Idempotency-Key" => "i1" }
    end
    assert_response :success
    assert_equal "reported", data["status"]
    assert_equal "filing it", data["decision_note"]
    assert_equal users(:admin).email, data["decided_by"]
    assert_equal "https://github.com/A-RYAN-1/fintech-fraud-detection/issues/99", data["issue_url"]
    post "/api/v1/admin/incidents/#{incident.id}/approve", headers: { "Idempotency-Key" => "i2" }
    assert_response :conflict
  end

  test "an issue link that is not https is refused and the incident stays open" do
    incident = make_incident
    login_as users(:admin)
    post "/api/v1/admin/incidents/#{incident.id}/approve", params: { issue_url: "javascript:alert(1)" }, headers: { "Idempotency-Key" => "i3" }
    assert_response :unprocessable_entity
    assert incident.reload.open?
  end

  test "dismissing closes it with an audit row" do
    incident = make_incident
    login_as users(:admin)
    assert_difference -> { AuditLog.where(event_type: "INCIDENT_DISMISSED").count }, 1 do
      post "/api/v1/admin/incidents/#{incident.id}/dismiss", params: { note: "known sandbox outage" }, headers: { "Idempotency-Key" => "d1" }
    end
    assert_equal "dismissed", data["status"]
    get "/api/v1/admin/incidents"
    assert_empty data["incidents"]
  end

  test "suggest stores a note when the analyst answers and says so when it cannot" do
    incident = make_incident
    login_as users(:admin)
    replace_class_method(IncidentAdvisor, :suggest, ->(*, **) { nil }) do
      post "/api/v1/admin/incidents/#{incident.id}/suggest", headers: { "Idempotency-Key" => "s1" }
    end
    assert_response :service_unavailable
    replace_class_method(IncidentAdvisor, :suggest, ->(*, **) { "Likely cause: sandbox outage. First check: status page." }) do
      post "/api/v1/admin/incidents/#{incident.id}/suggest", headers: { "Idempotency-Key" => "s2" }
    end
    assert_response :success
    assert_includes data["ai_note"], "sandbox outage"
    assert_includes data["draft"]["body"], "not verified"
  end

  test "scan reads failed jobs into incidents for any staff member" do
    job = SolidQueue::Job.create!(queue_name: "default", class_name: "BoomJob", arguments: "{}", active_job_id: SecureRandom.uuid)
    SolidQueue::FailedExecution.create!(job: job, error: { "exception_class" => "RuntimeError", "message" => "boom", "backtrace" => [] })
    login_as users(:analyst)
    post "/api/v1/admin/incidents/scan"
    assert_response :success
    assert_equal 1, data["observed"]
    assert_equal 1, data["open_count"]
  end

  test "a failed PayPal capture in the review queue is recorded with the status and debug id and no email" do
    payment = users(:one).transactions.create!(amount: 50, device_id: "d", status: "FLAGGED", paypal_status: "HELD", paypal_authorization_id: "AUTH-1",
                                                paypal_order_id: "PP-ORDER-1")
    login_as users(:admin)
    replace_class_method(PaypalClient, :configured?, -> { true }) do
      replace_class_method(PaypalClient, :new, ->(*) { FailingClient.new }) do
        post "/api/v1/admin/review_queue/#{payment.id}/approve", headers: { "Idempotency-Key" => "r1" }
      end
    end
    assert_response :bad_gateway
    incident = Incident.find_by!(kind: "paypal_error")
    assert_equal "PayPal capture failed (HTTP 502)", incident.title
    assert_equal "dbg-77", incident.sample["debug_id"]
    assert_equal payment.id, incident.sample["payment_id"]
    assert_no_match(/buyer@example\.com/, incident.detail)
    assert_equal "HELD", payment.reload.paypal_status
  end
end
