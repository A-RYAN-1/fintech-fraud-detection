require "test_helper"

class IncidentDrafterTest < ActiveSupport::TestCase
  def incident(**attrs)
    Incident.create!({ fingerprint: "paypal_error:capture:502", kind: "paypal_error", title: "PayPal capture failed (HTTP 502)",
                       detail: "Bad gateway", sample: { "action" => "capture", "status" => 502, "debug_id" => "dbg-1" },
                       occurrences: 7, first_seen_at: Time.utc(2026, 10, 30, 8), last_seen_at: Time.utc(2026, 10, 30, 9) }.merge(attrs))
  end

  test "the issue names the counts, the evidence and what to check" do
    draft = IncidentDrafter.issue(incident)
    assert_equal "[Sentrix] PayPal capture failed (HTTP 502)", draft[:title]
    assert_includes draft[:body], "Seen 7 times, first 2026-10-30 08:00 UTC, last 2026-10-30 09:00 UTC."
    assert_includes draft[:body], "- debug id: dbg-1"
    assert_includes draft[:body], "- last message: Bad gateway"
    assert_includes draft[:body], "## What to check"
    assert_includes draft[:body], "nothing was changed in code, rules or payments"
  end

  test "an AI note is shown as unverified and a recurrence is stated" do
    body = IncidentDrafter.issue(incident(ai_note: "Likely cause: sandbox outage.", recurrences: 2))[:body]
    assert_includes body, "AI analyst suggestion (not verified)"
    assert_includes body, "came back 2 times after an earlier report was closed"
  end

  test "the new issue link opens GitHub with the draft filled in and is bounded" do
    url = IncidentDrafter.issue_url(incident(detail: "x" * 280))
    assert url.start_with?("https://github.com/A-RYAN-1/fintech-fraud-detection/issues/new?title=")
    assert_includes url, "&body="
    assert_operator url.length, :<, 9000
  end

  test "the digest counts open incidents and says so when there are none" do
    assert_match(/No open incidents/, IncidentDrafter.digest([]))
    text = IncidentDrafter.digest([ incident ], now: Time.utc(2026, 10, 30, 10))
    assert_includes text, "1 open incident, 7 occurrences in total"
    assert_includes text, "1. **PayPal capture failed (HTTP 502)**: 7 times"
    assert_includes text, "Nothing is filed until a person approves it."
  end
end
