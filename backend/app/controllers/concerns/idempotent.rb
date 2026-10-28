# Safe retries for money-moving endpoints. A client sends `Idempotency-Key: <unique string>`; then
#   - the first request runs and its response (status and body) is stored under (user, key);
#   - the same key with the same request returns the stored response again, with `Idempotency-Replayed: true`,
#     and runs nothing (no second transaction, no second PayPal call);
#   - the same key with a different method, path or body is a 422, never a silent replay of the wrong answer;
#   - the same key while the first request is still running is a 409 (retry shortly);
#   - a 5xx answer or a crash is not stored, so the client can retry with the same key.
# Without the header the request runs as before. Keys are kept 24 hours.
module Idempotent
  extend ActiveSupport::Concern

  HEADER = "Idempotency-Key".freeze
  REPLAY_HEADER = "Idempotency-Replayed".freeze

  class_methods do
    # Declare after the authentication filters: the key is scoped to the signed-in user.
    def idempotent(*actions)
      around_action :with_idempotency, only: actions
    end
  end

  private

  def idempotency_key
    request.headers[HEADER].to_s.strip.presence
  end

  def with_idempotency
    key = idempotency_key
    return yield unless key

    record = claim_idempotency_key(key)
    return unless record

    begin
      yield
    rescue Exception # rubocop:disable Lint/RescueException
      record.destroy
      raise
    end
    store_idempotent_response(record)
  end

  # Returns the fresh record to run under, or renders the replay or the error and returns nil.
  def claim_idempotency_key(key)
    record = current_user.idempotency_keys.new(key: key, request_method: request.request_method, request_path: request.path,
                                               request_fingerprint: request_fingerprint)
    unless record.valid?
      render_error("Idempotency-Key must be 1 to 255 letters, digits, dashes, dots, colons or underscores", :unprocessable_entity)
      return nil
    end

    IdempotencyKey.purge_expired
    record.save!
    record
  rescue ActiveRecord::RecordNotUnique
    resolve_existing_key(key)
  end

  def resolve_existing_key(key)
    existing = current_user.idempotency_keys.find_by(key: key)
    return claim_idempotency_key(key) if existing.nil?
    return claim_after_stale(existing, key) if existing.stale?

    if existing.request_fingerprint != request_fingerprint
      render_error("Idempotency-Key was already used with a different request", :unprocessable_entity)
    elsif existing.completed?
      response.set_header(REPLAY_HEADER, "true")
      render body: existing.response_body, status: existing.response_status, content_type: "application/json"
    else
      response.set_header("Retry-After", "1")
      render_error("A request with this Idempotency-Key is still in progress", :conflict)
    end
    nil
  end

  def claim_after_stale(existing, key)
    existing.destroy
    claim_idempotency_key(key)
  end

  def store_idempotent_response(record)
    if response.status >= 500
      record.destroy
    else
      record.update!(response_status: response.status, response_body: response.body)
    end
  end

  # Method, path and parameters in a stable order, so the same request always has the same fingerprint.
  def request_fingerprint
    params_hash = request.request_parameters.deep_stringify_keys
    Digest::SHA256.hexdigest([ request.request_method, request.path, canonical(params_hash) ].to_json)
  end

  def canonical(value)
    case value
    when Hash then value.sort.map { |k, v| [ k, canonical(v) ] }
    when Array then value.map { |v| canonical(v) }
    else value.to_s
    end
  end
end
