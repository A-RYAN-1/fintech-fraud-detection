# Drafts the text a person files: one GitHub issue per incident and one digest of everything open. Plain templates over
# the stored facts, so the same incident always reads the same and nothing is invented. Drafting files nothing and
# changes nothing: the person reads it, edits it if they want, approves it, and opens the issue themselves.
module IncidentDrafter
  REPO = ENV.fetch("GITHUB_REPO", "A-RYAN-1/fintech-fraud-detection")
  MAX_URL_BODY = 5000

  CHECKS = {
    "paypal_error" => [
      "Open the PayPal debug id below in the PayPal developer dashboard (Sandbox, Dashboard, API calls) for the exact reason.",
      "Check the PayPal status page and that the app credentials in the environment are the sandbox ones for this app.",
      "The payment keeps its state when a call fails: nothing was captured or voided by the failed call, and the same action can be retried safely (the request id is derived from the payment)."
    ],
    "job_failed" => [
      "Read the error under Solid Queue failed executions (the job class and message are above).",
      "Retry the job once the cause is fixed; jobs here are safe to run again."
    ],
    "analyst" => [
      "Check the Gemini API key, quota and model name (Help shows the analyst state; the circuit opens after repeated failures).",
      "While it is down, payments are decided by the rules and the risk model alone; the AI never lifts a hold."
    ]
  }.freeze

  def self.issue(incident)
    { title: "[Sentrix] #{incident.title}", body: issue_body(incident) }
  end

  # A link that opens GitHub's new issue form with the draft filled in. A person still presses Submit.
  def self.issue_url(incident)
    draft = issue(incident)
    body = draft[:body].first(MAX_URL_BODY)
    "https://github.com/#{REPO}/issues/new?title=#{ERB::Util.url_encode(draft[:title])}&body=#{ERB::Util.url_encode(body)}"
  end

  def self.issue_body(incident)
    lines = []
    lines << "## What happened"
    lines << "#{incident.title}. Seen #{incident.occurrences} time#{'s' unless incident.occurrences == 1}, " \
             "first #{stamp(incident.first_seen_at)}, last #{stamp(incident.last_seen_at)}."
    lines << "It came back #{incident.recurrences} time#{'s' unless incident.recurrences == 1} after an earlier report was closed." if incident.recurrences.positive?
    lines << ""
    lines << "## Evidence"
    incident.sample.each { |key, value| lines << "- #{key.to_s.tr('_', ' ')}: #{value}" }
    lines << "- last message: #{incident.detail}" if incident.detail.present?
    lines << ""
    lines << "## What to check"
    CHECKS.fetch(incident.kind).each { |check| lines << "- #{check}" }
    if incident.ai_note.present?
      lines << ""
      lines << "## AI analyst suggestion (not verified)"
      lines << incident.ai_note
    end
    lines << ""
    lines << "_Drafted by the Sentrix incident digest from recorded failures. A person read and approved this before it was filed; nothing was changed in code, rules or payments._"
    lines.join("\n")
  end

  # Everything open, newest first, as one report.
  def self.digest(incidents, now: Time.current)
    return "No open incidents. Nothing failed that a person has not already handled." if incidents.empty?

    lines = [ "# Sentrix incident digest", "", "Drafted #{stamp(now)}. #{incidents.size} open incident#{'s' unless incidents.size == 1}, " \
              "#{incidents.sum(&:occurrences)} occurrences in total.", "" ]
    incidents.each_with_index do |incident, index|
      lines << "#{index + 1}. **#{incident.title}**: #{incident.occurrences} time#{'s' unless incident.occurrences == 1}, " \
               "first #{stamp(incident.first_seen_at)}, last #{stamp(incident.last_seen_at)}#{incident.recurrences.positive? ? ', came back after a report' : ''}"
    end
    lines << ""
    lines << "Each incident has its own issue draft. Nothing is filed until a person approves it."
    lines.join("\n")
  end

  def self.stamp(time)
    time.utc.strftime("%Y-%m-%d %H:%M UTC")
  end
  private_class_method :stamp, :issue_body
end
