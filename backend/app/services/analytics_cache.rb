# The numbers behind Insights and My Spending are sums over many rows, and the pages are opened and refreshed far more
# often than payments arrive. The result is kept 60 seconds in Rails.cache (solid_cache in production, shared by every
# process) under a key that carries a version: any change to a payment or its evaluation changes the version
# (Transaction and FraudEvaluation call `bump`), so a number is never older than the last payment and at most 60 s old
# when nothing moved. A cache that is down is skipped, not an error.
module AnalyticsCache
  TTL = 60.seconds
  VERSION_KEY = "analytics:version".freeze

  def self.fetch(*parts, &block)
    Rails.cache.fetch([ "analytics", version, *parts ], expires_in: TTL, &block)
  rescue StandardError => e
    Rails.logger.warn(event: "analytics_cache_error", error: e.class.name)
    yield
  end

  def self.version
    Rails.cache.fetch(VERSION_KEY) { SecureRandom.hex(4) }
  end

  def self.bump
    Rails.cache.write(VERSION_KEY, SecureRandom.hex(4))
  rescue StandardError
    nil
  end
end
