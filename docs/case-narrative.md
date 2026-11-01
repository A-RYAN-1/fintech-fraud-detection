# Case narrative

A reviewer can draft a short, regulator-style write-up of a held case and attach it to the decision:

- **Summary:** two or three sentences on what was held and why.
- **Risk indicators:** up to five statements, each grounded in one stored fact.
- **Before deciding, check:** up to four things a person should verify. They are checks, not decisions.

The narrative is advice. It never changes the payment, the rules decision or the stored AI verdict.

## Endpoint

`POST /api/v1/admin/review_queue/:id/narrative`

- Staff only (analyst, reviewer, admin). A customer gets 403; an unknown case is 404.
- No body and no free text, so there is nothing to carry an injection into the prompt.
- Shares the `ask_analyst` rate limit (6 a minute per signed-in person), on top of the analyst's token bucket and circuit breaker.
- Response: `{ summary, indicators, reviewer_checks, source, model, created_at }`. `source` is `ai` or `rules`.

## What the analyst sees

The same facts-only payload as the verdict and Ask the analyst (`AskAnalyst#facts`): bands, flags, rule names, model reason labels and the account ring bands. No user id, email, IP address, device id or payment id leaves the server, and the call has no tools. A test asserts that none of those values appear in the prompt.

## Saved to the audit trail

Each draft writes one `CASE_NARRATIVE` audit row for the payment: who asked, whether the AI analyst or the fixed template wrote it, the model, and the full text in `after_state`. A reviewer can show later what the narrative said when they decided.

## When the analyst cannot write it

If the analyst is off, the circuit is open, the bucket is empty, the call fails or the summary is empty, a fixed template built from the same facts is returned and saved with `source: "rules"`. The screen says so, so a fallback is never presented as the analyst.

## Frontend

`CaseNarrativePanel` sits in each case card. Nothing is requested until the button is pressed; the draft is kept for the session, so hiding and showing it does not draft again.

## Tests

- `test/services/case_narrative_test.rb`: facts only (no identifier in the prompt), audit row written, open circuit and model failure fall back to the template, empty summary falls back, caps on length and item count, the payment is untouched.
- `test/integration/review_queue_test.rb`: staff only, audit row written, 404 on an unknown case.
- `CaseNarrativePanel.test.tsx`: no request until clicked, lists and advice line shown, rules-only label, one request per case, error text.
