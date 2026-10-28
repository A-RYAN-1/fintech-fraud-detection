# Feedback loop: reviewer decisions as labels

A person who captures or voids a held payment has told Sentrix what the right answer was. Sentrix keeps that answer and scores every automatic signal against it, so you can see which signal the humans trust and where they disagree.

## What counts as a label

| Event | Label | Source |
|---|---|---|
| A person captures a payment that was held | `approve` | `decision` |
| A person voids a payment that was held | `block` | `decision` |
| A full refund of a captured payment (any person) | `block` | `refund` (replaces an earlier `approve`) |
| The agent captures, holds or voids by itself | none | the agent is not ground truth |
| A partial refund | unchanged | not enough to call it fraud |

The label sits on the payment's `fraud_evaluation`: `human_label`, `label_source`, `labeled_by_id`, `labeled_at`. The evaluation also stores the model's feature vector (`ml_features`), so the labelled rows can be exported and the model retrained later (ML-1).

## What is scored

Each signal votes **safe** or **risky** on every labelled payment. The human vote is safe for `approve`, risky for `block`.

| Signal | Risky when |
|---|---|
| `rules` | the payment's status is flagged or blocked (rules and model together) |
| `ml` | the model score is at or above its flag threshold (the model alone) |
| `ai` | the analyst's action is review or block; no vote when the analyst was down |

Per signal: `agreement_rate` (agree over answered), `false_alarms` (called risky, human approved) and `misses` (called safe, human blocked). A daily series gives the same agreement per day of decision. `GET /api/v1/admin/feedback?signal=rules|ml|ai&page=1` returns the summary and the paginated list of payments where at least one signal disagreed; staff only (analyst, reviewer, admin). The page is **Feedback** in the sidebar.

## Numbers from a local run (synthetic)

`SEED=42 rake demo:traffic` on the local stack: 108 payments, 11 decided by the scripted reviewer (5 approved, 6 blocked), spread over 8 days. The AI analyst is off in the generator, so it has no votes here.

| Signal | Answered | Agree | Agreement | False alarms | Misses |
|---|---|---|---|---|---|
| Rules and model | 11 | 6 | 54.5% | 5 | 0 |
| Model alone | 11 | 9 | 81.8% | 0 | 2 |
| AI analyst | 0 | 0 | n/a | 0 | 0 |

How to read it: the rules hold travellers on a new device (5 false alarms, nothing missed), the model alone is closer to the scripted humans but misses 2 ring payments. These decisions are scripted by the traffic generator, so this table shows the page and the maths working, not how the signals perform on real fraud. Any claim about accuracy needs real reviewer decisions.

## Tests

`FeedbackReportTest` (labels set by a person's capture and void, not by the agent, not when the payment was not held, refund turns approve into block, partial refund does not; agreement, false alarms and misses on fixed fixtures; daily grouping; disagreement filter) and `FeedbackTest` (401, 403 for a customer, staff summary, signal filter, 422 for an unknown signal). Frontend: `FeedbackPage.test.tsx`.
