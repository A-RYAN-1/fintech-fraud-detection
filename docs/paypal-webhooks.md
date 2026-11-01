# PayPal webhooks

`POST /api/v1/paypal/webhooks` receives PayPal's event notifications. PayPal's server calls it, so there is no session; the signature is the credential.

## Flow

1. **Configured?** Needs `PAYPAL_WEBHOOK_ID` and the PayPal client keys. Without them the endpoint answers 503 and stores nothing.
2. **Parse.** A body that is not JSON, or has no `id` and `event_type`, is a 400 before PayPal is asked anything. Bodies over 64 KB are refused (413).
3. **Verify.** `PaypalClient#verify_webhook` calls PayPal's verify-webhook-signature with the five `PAYPAL-*` transmission headers, our webhook id and the event. Only `SUCCESS` passes; anything else is a 401 and nothing is stored. If PayPal cannot be reached the answer is 503, so PayPal retries later.
4. **Dedupe.** The event id goes into `webhook_events` with a unique index. A replay of an event that was handled is acknowledged (`duplicate`) and changes nothing. If two deliveries race, the unique index lets one create the row and the other read it.
5. **Apply.** The row is handled once. An event whose first handling raised is marked `failed` and answers 500; PayPal's retry of the same event id handles it again.

## What changes a payment

Only `PAYMENT.AUTHORIZATION.VOIDED`: a payment that is still `HELD` or `AUTHORIZED` moves to `VOIDED` (the authorization was voided or expired on PayPal's side) and a `PAYPAL_VOIDED` audit row is written with the event id. Our own voids already set `VOIDED`, so their event is only recorded.

Every other event type is recorded and nothing else changes. Refund events are deliberately not replayed into `refunded_amount`: our own refunds raise the same events and would be counted twice.

## Outcomes

`webhook_events.outcome`: `applied` (changed a payment), `recorded` (valid, nothing to change), `failed` (the handler raised, handled again on the next delivery), `received` (stored, not yet handled).

## Rate limits

The general per-address throttle skips this path (PayPal retries from a small set of addresses); the signature check is the guard.

## Tests

- `test/services/paypal_webhook_test.rb`: a voided authorization voids a held payment with an audit row; a replay changes nothing; a payment that is no longer open is recorded only; other event types and unknown authorizations are recorded only; an unverified event is refused and not stored; no webhook id and bad bodies never reach PayPal; PayPal unreachable is a retryable failure; a failed first handling is repaired by the next delivery.
- `test/integration/paypal_webhooks_test.rb`: 503 without a webhook id, 400 for a bad body without signing in, 413 for an oversized body.
