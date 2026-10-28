# Idempotency

Payment endpoints accept an `Idempotency-Key` header so a retry (dropped connection, double click, timeout) returns the first answer instead of paying twice.

Covered: `POST /paypal/orders`, `POST /payments/simulate`, `POST /paypal/orders/:id/authorize`, and the admin `POST /admin/review_queue/:id/approve|void|refund`.

| Situation | Result |
|---|---|
| No header | The request runs as before |
| First request with a key | Runs; status and body are stored under (user, key) |
| Same key, same method, path and body | Stored response replayed, header `Idempotency-Replayed: true`, nothing runs again |
| Same key, different method, path or body | 422, nothing runs |
| Same key while the first request is still running | 409 with `Retry-After: 1` |
| First request answered 5xx or crashed | Not stored; the same key can be retried |
| Key malformed (not 1 to 255 of letters, digits, `- . : _`) | 422 |
| Claim older than 2 minutes without a response (process died) | Freed; the retry runs |
| Key older than 24 hours | Purged on the next keyed request |

Keys are private to the signed-in user: the unique index is on (user, key).

## PayPal's own layer

The order-create key is hashed with the user id and sent as `PayPal-Request-Id`, so a retry that gets past our table (a crash between the PayPal call and the stored response) still cannot create a second PayPal order. Capture, void and refund keep a request id derived from the transaction (`capture-<id>`, `void-<id>`, `refund-<id>`), which is stronger than a client key: any number of keys for one payment still move the money once. Authorize uses `authorize-<order id>`.

## Client

The frontend keeps one key per intent (`utils/idempotency.ts`): the same key is sent on a retry of the same amount, device or review action, and a new key after a success.

## Limits

The table is in Postgres, so replay is exact on the one Render instance and on any number of instances sharing the database. A response is stored up to the size of the body (a few KB).
