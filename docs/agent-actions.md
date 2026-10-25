# Agent actions and limits

After PayPal authorizes a payment (funds held, nothing taken), Sentrix scores it and the agent picks one action. The rules and the model are the floor; the AI analyst can only confirm or escalate.

## Decision table

| Rules + model | AI verdict | Limits | Agent action |
|---|---|---|---|
| Blocked | any or none | n/a | void (nothing is charged) |
| Flagged | any or none | n/a | hold, a human decides |
| Approved | none or approve | inside | capture |
| Approved | none or approve | over a limit | hold, the reason names the limit |
| Approved | review | any | hold (escalated) |
| Approved | block | any | hold (the AI recommends, a human decides; the AI never voids alone) |

The table is pure code in `AgentActionPolicy` and is tested row by row (`test/services/agent_action_policy_test.rb`). If the AI fails or is switched off, its column reads "none" and the rules decision stands.

## Limits (admin, in the editable rules table)

| Key | Default | Range | Meaning |
|---|---|---|---|
| `max_auto_capture_amount` | 1,000 | 1 to 100,000 | Largest payment the agent may capture without a human |
| `daily_auto_capture_cap` | 5,000 | 1 to 10,000,000 | Most the agent may capture on its own in one UTC day |

Changed through `PATCH /api/v1/admin/risk_rules/:key` (admin only, range checked, audited). Captures a human approved do not count against the daily cap. The limit is checked again under a Postgres advisory lock at capture time, so two parallel payments cannot both fit under the last of the cap.

## Tools (`PaypalActions`)

`capture`, `hold`, `void`, `refund`. Each is idempotent (asking for the state the payment is already in does nothing and makes no PayPal call), refuses a state it cannot move from (HTTP 409 over the API), sends a `PayPal-Request-Id` derived from the transaction, and writes an `AuditLog` row with the actor, the reason and the AI explanation.

| Action | From | To |
|---|---|---|
| hold | AUTHORIZED | HELD |
| capture | AUTHORIZED, HELD | CAPTURED |
| void | AUTHORIZED, HELD | VOIDED |
| refund | CAPTURED | REFUNDED |

## Review queue (admin API)

- `GET /api/v1/admin/review_queue`: held payments with rules triggered, model reasons, the AI verdict and the reason the agent held it (admin or manager).
- `POST /api/v1/admin/review_queue/:id/approve | void | refund` with an optional `note` (admin only). A human approval is not bound by the limits and is recorded as `capture_mode: human`.
