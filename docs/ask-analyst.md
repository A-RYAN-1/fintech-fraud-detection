# Ask the analyst

A reviewer can ask the AI analyst one question about a held case from the review queue:

- **Why this verdict?** Why the rules decision and the facts point the way they do.
- **What would change it?** Which facts, if different, would lower or raise the risk, as conditions a reviewer can check.

The answer is advice on screen. Nothing is stored, no audit row is written, and the decision, the payment status and the stored verdict never change.

## Endpoint

`POST /api/v1/admin/review_queue/:id/ask` with `{ "question": "why" | "change" }`.

- Staff only (analyst, reviewer, admin). A customer gets 403.
- The question is one of two fixed values. Anything else is 422, so there is no free text to carry an injection into the prompt.
- Rate limited by Rack::Attack: 6 asks a minute per signed-in person (`ask_analyst`), on top of the analyst's own token bucket and circuit breaker.
- Response: `{ question, answer, source, model }`. `source` is `ai` or `rules`.

## What the analyst sees

The same facts-only payload the verdict used (`AiFactsBuilder`), rebuilt from what was stored for the case (`AskAnalyst#facts`): bands, flags, rule names, model reason labels, and the account ring bands from RG-1 (`linked_accounts`, `linked_accounts_voided_by_a_person`). No user id, email, IP address, device id or payment id leaves the server, and the call has no tools. A test asserts that none of those values appear in the prompt.

## Same path, same guard

`AiAnalyst#answer` goes through the same `AnalystGuard` token bucket and circuit breaker, the same single quick retry, and the same Gemini client as the verdict, with its own system prompt and a one-field schema (`answer`, at most 600 characters). The system prompt forbids giving a new decision.

## When the analyst cannot answer

If the analyst is off, the circuit is open, the bucket is empty, the call fails or the answer is empty, the endpoint returns a fixed rules-only answer built from the same facts (`AskAnalyst::RulesAnswer`) with `source: "rules"`. The screen says so ("Rules-only answer: the AI analyst was not available."), so the button never dead-ends and a fallback is never presented as the analyst.

## Frontend

`AskAnalystPanel` sits next to the linked accounts panel in each case card. The answer component is mounted only after a click, so listing cases makes no request and needs no query client. The answer is cached for five minutes per case and question.

## Tests

- `test/services/ask_analyst_test.rb`: facts only (no identifiers in the prompt), open circuit falls back without a model call, model failure and empty answer fall back, unknown question never reaches the model, asking changes nothing.
- `test/integration/review_queue_test.rb`: staff only, 422 on a bad question, 404 on an unknown case.
- `AskAnalystPanel.test.tsx`: no request until clicked, answer shown with the advice line, rules-only label, error text.
