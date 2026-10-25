# AI analyst: offline evaluation

The AI analyst (`backend/app/services/ai_analyst.rb`) reads the facts the rules and the risk model produced for one transaction and returns approve, review or block with a confidence and a plain-language explanation. This page measures it on 30 labelled cases before it is allowed to act (agent actions with limits are a separate feature).

## How it was measured

- **Cases:** `backend/test/fixtures/files/ai_eval_cases.json`, 30 hand-written transactions (11 approve, 9 review, 10 block) in the exact shape `AiFactsBuilder` sends: bands, flags, rule names and model labels. No ids, emails, IP addresses or device ids.
- **Labels:** written by hand from a rubric, not taken from real fraud data. Approve when signals are weak or absent; review when one strong signal or several moderate ones; block when several strong signals agree. Cases are placed where the rules engine is wrong in both directions (it misses risky payments that trip no rule, and flags harmless ones), so the table shows what the analyst adds, not only agreement.
- **Run:** `bin/rails ai:evaluate` (calls Gemini, model `gemini-3.1-flash-lite`, temperature 0, 2026-10-25). All 30 calls were answered.

## Result

| | Agrees with the label |
|---|---|
| Rules engine alone | 20 of 30 (67%) |
| AI analyst | 27 of 30 (90%) |
| AI analyst vs rules engine | agree on 21 of 30 (70%) |

| Label | Rules right | AI right |
|---|---|---|
| approve (11) | 9 | 9 |
| review (9) | 5 | 8 |
| block (10) | 6 | 10 |

The gain is on the risky end. The rules under-react when the amount is large but no single rule fires (a first payment of 5,000 or more, a payment at night), and when several moderate signals sit just under the flag threshold. The analyst did not turn any block case into an approve.

## Where it was wrong

- **A09** (label approve, rules review, AI review, confidence 0.85): flagged a small first payment for the missing trusted device.
- **R10** (label approve, rules review, AI review, confidence 0.85): flagged a normal payment for an unfamiliar device.
- **R08** (label review, rules review, AI approve, confidence 0.85): approved a 5,000-and-above payment from a trusted device at the user's usual amount because no negative signal was present.

A09 and R10 are the cases built to be over-flagged by the rules; the analyst repeated the rules there. R08 is the one place it was less careful than the label asked for.

## Limits to keep in mind

- 30 cases written by one person is a smoke test of behaviour, not a benchmark of fraud detection accuracy; the labels encode our rubric.
- The analyst is advisory. Its verdict is stored next to the rules decision and shown to a reviewer; it never changes a payment status in this layer. Any failure (no key, timeout, 429, malformed JSON) returns nothing and the rules decision stands alone.
- Free tier: `gemini-2.5-flash` returns 404 for keys created after its cutoff and `gemini-3-flash-preview` answers 429 after a handful of calls a minute, so the default is the stable `gemini-3.1-flash-lite`, overridable with `GEMINI_MODEL`.
