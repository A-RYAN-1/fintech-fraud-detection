require "test_helper"

class HealthControllerTest < ActionDispatch::IntegrationTest
  test "should get check" do
    get api_v1_health_url
    assert_response :success
    json_response = JSON.parse(response.body)
    assert_equal "ok", json_response["status"]
  end

  test "deep health reports database, queue and analyst without signing in" do
    AnalystGuard.reset!
    get "/api/v1/health/deep"
    assert_response :success
    body = response.parsed_body
    assert_includes %w[ok degraded], body["status"]
    assert_equal "up", body.dig("database", "status")
    assert_kind_of Numeric, body.dig("database", "latency_ms")
    assert body["queue"].key?("status")
    assert_equal "closed", body.dig("analyst", "circuit")
    assert_nil body.dig("analyst", "last_call_at")
  end

  test "deep health shows the time of the last analyst call" do
    AnalystGuard.reset!
    AnalystGuard.instance.acquire
    get "/api/v1/health/deep"
    assert_not_nil response.parsed_body.dig("analyst", "last_call_at")
  ensure
    AnalystGuard.reset!
  end

  test "deep health is 503 when the database is down" do
    fake = Class.new(DeepHealth) { def check_database = { status: "down", error: "PG::ConnectionBad" } }.new
    replace_class_method(DeepHealth, :new, ->(*) { fake }) { get "/api/v1/health/deep" }
    assert_response :service_unavailable
    assert_equal "down", response.parsed_body["status"]
  end

  test "deep health reports a queue with no worker as degraded, still 200" do
    fake = Class.new(DeepHealth) { def check_queue = { status: "no_worker", workers: 0, ready_jobs: 3 } }.new
    replace_class_method(DeepHealth, :new, ->(*) { fake }) { get "/api/v1/health/deep" }
    assert_response :success
    assert_equal "degraded", response.parsed_body["status"]
  end

  test "deep health does not need a session and is not cached" do
    get "/api/v1/health/deep"
    assert_response :success
    assert_no_match(/public/, response.headers["Cache-Control"].to_s)
  end
end
