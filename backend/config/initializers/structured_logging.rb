# JSON logs in production (or anywhere LOG_FORMAT=json); see lib/structured_logging.rb.
if Rails.env.production? || ENV["LOG_FORMAT"] == "json"
  Rails.application.config.after_initialize { StructuredLogging.install!(Rails.logger) }
end
