# Agent mandates

A shopping agent can pay for a person, but only inside a written permission. A mandate is that permission: one merchant, a cap per payment, a cap in total, an end date, and it can be revoked at any moment. It limits what an agent may ask for. It does not replace the risk check: every payment inside a mandate still goes through the rules, the model, the AI analyst and the admin limits, and can be captured, held for a person or voided.

## Why

An agent that holds a card number can spend without limit. A mandate gives the owner the control that a card does not: the agent never sees payment details, its token is useless outside the mandate, and revoking it stops the agent at once.

## How it works

1. The customer opens **Agents**, names the agent, picks the merchant, the most per payment, the most in total and the number of days (1 to 30), and creates the mandate. A token (`smt_...`) is shown once. Only its SHA-256 digest is stored, so the server cannot show it again.
2. The agent calls `POST /api/v1/agent/payments` with `Authorization: Bearer <token>` (or `X-Mandate-Token`), an `amount`, the `merchant`, an optional `device_id` and `purpose`. A browser login is not accepted on this endpoint.
3. The mandate is checked first, in this order: revoked, expired, wrong merchant, above the per-payment cap, above what is left of the total cap. A refusal is a `403` with a stable code (`mandate_revoked`, `mandate_expired`, `merchant_not_allowed`, `over_per_payment_cap`, `over_total_cap`), writes a `MANDATE_REFUSED` audit row and creates nothing.
4. Inside the mandate the amount is reserved under a row lock (two parallel payments cannot both fit the last of the cap), then the normal pipeline runs. If the rules void the payment, the reserved amount is given back, so a voided payment never uses up a mandate.
5. A `MANDATE_PAYMENT` audit row records the agent, the decision, and the amount spent against the cap. The payment belongs to the person who gave the mandate, and appears in their history and in the review queue like any other.

Other endpoints: `GET /api/v1/agent/mandate` (what the agent may still do), `GET /api/v1/agent_mandates`, `POST /api/v1/agent_mandates` and `POST /api/v1/agent_mandates/:id/revoke` for the owner (staff see and can revoke all). The agent endpoint accepts an `Idempotency-Key`, so a retried call settles once and uses the cap once. It is rate limited to 10 a minute per token.

## Who sees what

- **The owner** gets one in-app notice per agent payment: the amount, the merchant, the outcome (paid, held for review, not completed) and what is left on the mandate. A failed notice is logged and never undoes or hides the payment.
- **The reviewer** sees, on a held agent payment, which agent paid and the mandate it paid under (merchant, caps, used, left, status), and can revoke the mandate from the case. Revoking never touches the payment; the reviewer still decides it. The mandate is context for the reviewer only: it is not part of the facts the AI analyst sees.

## What is simulated

An agent cannot click through the PayPal approval popup, so agent payments use the simulated PayPal client: authorization, capture, hold and void are local state and no money moves. The decision path (rules, model, analyst, limits, hold or capture) is the real one. The merchant is a label the mandate enforces; Sentrix has one demo store.

## What this does not claim

- It is not an implementation of any card-network or PayPal agent-payment standard; it is our own small mandate model.
- The caps are enforced by this service. PayPal does not know about the mandate.
- Tokens are bearer secrets: whoever holds one can spend within the caps until it is revoked or expires.

## Demo data

`bin/rails demo:traffic` (and `AGENTS=0` to skip) seeds one customer, Priya Agents (`demo.agentowner@demo.sentrix.test`), who owns four mandates: a groceries agent with three captured payments, a travel agent nearly out of cap, a gadget agent the owner revoked, and a deal hunter agent whose payment from a device the owner has not used is held for a reviewer. Four attempts outside a mandate (wrong merchant, above the per-payment cap, after revocation, past the total cap) are refused and audited as `MANDATE_REFUSED`. Everything is simulated; `bin/rails demo:clean` removes the customer, the mandates, their payments and the mandate audit rows.

## Tests

`test/models/agent_mandate_test.rb` (token stored as a digest, caps, expiry, reserve and release, exhaustion), `test/integration/agent_payments_test.rb` (inside the mandate, each refusal code, void gives the cap back, wrong or missing token, a session is not a token, suspended owner, idempotent retry, amount validation, throttle) and `test/integration/agent_mandates_test.rb` (create, token shown once, ownership, revoke, staff view) and, for the demo persona, `test/services/demo_traffic_test.rb`.
