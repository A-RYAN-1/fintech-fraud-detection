# Records failures as Incident rows. It must never raise: a failure while recording a failure would hide the first one.
# What is stored is bounded and scrubbed: no emails, 300 characters of detail, and for PayPal errors only the HTTP
# status, PayPal's issue name and debug id, the action and the payment id.
module IncidentLog
  MAX_DETAIL = 300
  EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/

  # A PayPal call failed. `action` is what Sentrix was doing (capture, void, refund, create_order, authorize, settle).
  def self.paypal_error(error, action:, payment_id: nil)
    status = error.respond_to?(:status) ? error.status : nil
    issue = error.respond_to?(:issue) ? error.issue : nil
    debug_id = error.respond_to?(:debug_id) ? error.debug_id : nil
    record(kind: "paypal_error", key: [ action, status || "no_status", issue ].compact.join(":"),
           title: "PayPal #{action.to_s.tr('_', ' ')} failed#{status ? " (HTTP #{status})" : ''}#{issue ? ", #{issue}" : ''}",
           detail: error.message,
           sample: { action: action.to_s, status: status, issue: issue, debug_id: debug_id, payment_id: payment_id&.to_s }.compact)
  end

  # One more occurrence of a failure seen as it happens.
  def self.record(kind:, key:, title:, detail: nil, sample: {})
    now = Time.current
    fingerprint = "#{kind}:#{key}"
    attrs = { detail: scrub(detail), sample: sample, last_seen_at: now }
    return if bump(fingerprint, attrs).positive?

    Incident.create!(fingerprint: fingerprint, kind: kind, title: title.to_s.first(160), first_seen_at: now, **attrs)
  rescue ActiveRecord::RecordNotUnique
    bump(fingerprint, attrs)
  rescue StandardError => e
    Rails.logger.warn(event: "incident_log_error", error: e.class.name)
    nil
  end

  # A count read from somewhere else (failed jobs, analyst counters): set it, do not add to it, so a scan run twice
  # does not double count. Reopens a reported or dismissed incident when the count went up.
  def self.observe(kind:, key:, title:, count:, first_seen_at:, last_seen_at:, detail: nil, sample: {})
    incident = Incident.find_or_initialize_by(fingerprint: "#{kind}:#{key}")
    if incident.new_record?
      incident.assign_attributes(kind: kind, title: title.to_s.first(160), occurrences: count, first_seen_at: first_seen_at,
                                 last_seen_at: last_seen_at, detail: scrub(detail), sample: sample)
    elsif count > incident.occurrences
      incident.assign_attributes(occurrences: count, last_seen_at: last_seen_at, detail: scrub(detail), sample: sample)
      incident.assign_attributes(status: :open, recurrences: incident.recurrences + 1) unless incident.open?
    else
      return incident
    end
    incident.save!
    incident
  rescue StandardError => e
    Rails.logger.warn(event: "incident_log_error", error: e.class.name)
    nil
  end

  def self.scrub(text)
    text.to_s.gsub(EMAIL, "[email]").squish.first(MAX_DETAIL).presence
  end

  # Adds one to the count; a reported or dismissed incident that happens again is open again.
  def self.bump(fingerprint, attrs)
    Incident.where(fingerprint: fingerprint).update_all([
      "occurrences = occurrences + 1, last_seen_at = :seen, detail = :detail, sample = :sample, " \
      "recurrences = recurrences + (CASE WHEN status = 'open' THEN 0 ELSE 1 END), status = 'open', updated_at = :seen",
      { seen: attrs[:last_seen_at], detail: attrs[:detail], sample: attrs[:sample].to_json }
    ])
  end
  private_class_method :bump, :scrub
end
