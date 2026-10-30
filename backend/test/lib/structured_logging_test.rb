require "test_helper"
require "stringio"

class StructuredLoggingTest < ActiveSupport::TestCase
  setup do
    @io = StringIO.new
    @logger = ActiveSupport::TaggedLogging.new(Logger.new(@io))
    @logger.formatter = StructuredLogging::Formatter.new
  end

  def lines
    @io.string.lines.map { |line| JSON.parse(line) }
  end

  test "a plain message becomes one JSON object with time and level" do
    @logger.info("hello")
    line = lines.first
    assert_equal "hello", line["message"]
    assert_equal "info", line["level"]
    assert_match(/\A\d{4}-\d\d-\d\dT/, line["time"])
    assert_not line.key?("request_id")
  end

  test "the first log tag is the request id" do
    @logger.tagged("req-123") { @logger.warn("careful") }
    assert_equal "req-123", lines.first["request_id"]
    assert_equal "warn", lines.first["level"]
  end

  test "a hash is logged as fields" do
    @logger.tagged("req-9") { @logger.info(event: "request", status: 200) }
    line = lines.first
    assert_equal "request", line["event"]
    assert_equal 200, line["status"]
    assert_equal "req-9", line["request_id"]
  end

  test "request_line carries route, status, timings and user id but no params" do
    started = Time.now
    event = ActiveSupport::Notifications::Event.new(StructuredLogging::EVENT, started, started + 0.0123, "1",
      { method: "GET", path: "/api/v1/home", controller: "Api::V1::HomeController", action: "show", status: 200,
        db_runtime: 4.56, user_id: 7, params: { "password" => "secret" } })
    line = StructuredLogging.request_line(event)
    assert_equal "Api::V1::HomeController#show", line[:route]
    assert_equal 200, line[:status]
    assert_equal 7, line[:user_id]
    assert_in_delta 12.3, line[:duration_ms], 0.5
    assert_not line.key?(:params)
    assert_no_match(/secret/, line.to_s)
  end
end
