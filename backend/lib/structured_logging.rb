# JSON logs: one object per line with the time, level and the request id (the first log tag), so a line in the
# Render log can be traced to one request and to the X-Request-Id header the browser saw. Each finished request
# also logs one "request" line with the route, status and timings. Parameters, bodies and addresses of callers are not part of it.
module StructuredLogging
  class Formatter < Logger::Formatter
    include ActiveSupport::TaggedLogging::Formatter

    def call(severity, time, _progname, message)
      payload = message.is_a?(Hash) ? message : { message: msg2str(message) }
      line = { time: time.utc.iso8601(3), level: severity.downcase, request_id: current_tags.first }.merge(payload).compact
      "#{JSON.generate(line)}\n"
    end
  end

  EVENT = "process_action.action_controller".freeze

  # The "request" line, built from the controller's process_action event.
  def self.request_line(event)
    payload = event.payload
    {
      event: "request",
      method: payload[:method],
      path: payload[:path],
      route: "#{payload[:controller]}##{payload[:action]}",
      status: payload[:status],
      duration_ms: event.duration.round(1),
      db_ms: payload[:db_runtime]&.round(1),
      user_id: payload[:user_id]
    }.compact
  end

  def self.install!(logger)
    logger.formatter = Formatter.new
    require "action_controller/log_subscriber"
    ActionController::LogSubscriber.detach_from(:action_controller)
    ActiveSupport::Notifications.subscribe(EVENT) { |event| logger.info(request_line(event)) }
  end
end
