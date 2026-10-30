# Incident digest

The agent reads the failures of the app, groups them, drafts the report, and stops there. A person approves it. The
agent never files an issue, edits code, changes a rule or touches a payment.

## What is recorded

| Kind | Where it comes from | How |
|---|---|---|
| `paypal_error` | A PayPal call failed: capture, void, refund, create order, authorize, settling an approval, voiding an expiring hold | Recorded the moment it happens (`IncidentLog.paypal_error`): HTTP status, PayPal issue name, debug id, action, payment id, a scrubbed 300 character message |
| `job_failed` | A background job ended in an error (Solid Queue failed executions) | `IncidentScan`, grouped by job class and error class, count set from the table |
| `analyst` | The AI analyst's call failures | `IncidentScan`, from the analyst guard's counters (per process, like the guard itself) |

Incidents are grouped by a fingerprint (kind, action, status), so "PayPal capture failed (HTTP 502), 7 times" is one
row with a first and last time, not seven log lines. Emails are scrubbed from messages; no request bodies, credentials
or customer data are stored. Recording never raises: a failure while recording a failure must not hide the first.
A scan runs every 30 minutes (`IncidentScanJob`) and on request (Scan now); running it twice does not double a count.

## The draft

`IncidentDrafter` writes a GitHub issue per incident (what happened, evidence, what to check) and a digest of
everything open, from the stored facts with a fixed template, so the same incident always reads the same and nothing is
invented. An admin can press "Ask the AI analyst for a likely cause": that sends the kind, counts and scrubbed
message (never payment or debug ids) through the same rate limit and circuit breaker as payment scoring, and stores a
400 character note shown as "AI analyst suggestion (not verified)". If the analyst is off or skipped, the draft stands
without it.

## The human gate

Staff (analyst, reviewer, admin) read the page and can scan. Only an admin can act:

- **Approve the report** marks it `reported`, records who and when, and writes an audit row (`INCIDENT_APPROVED`).
  The admin files the issue from "Open the GitHub issue form" (a prefilled `issues/new` link; GitHub's Submit button
  is the human step) and may paste the issue link back.
- **Dismiss** closes it with an audit row (`INCIDENT_DISMISSED`).
- If the same failure happens again after either, the incident reopens and counts a recurrence, and the draft says
  it came back after a report.

Endpoints: `GET /api/v1/admin/incidents?status=`, `POST /incidents/scan`, `POST /incidents/:id/approve|dismiss|suggest`
(decisions are idempotent: a retried click is answered, not repeated).

## Why not an auto-fix agent

An agent that edits code or opens pull requests from an alert would need credentials to the repository and to
production, and its mistakes would land without a person reading them. That contradicts the rest of the system, where
the AI never lifts a hold and an admin accepts every rule change. The digest does the part that is safe and saves the
time (finding, grouping, counting, writing it up) and leaves the decision and the fix to people.
