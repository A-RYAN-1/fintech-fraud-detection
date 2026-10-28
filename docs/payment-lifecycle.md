# Payment lifecycle

PayPal holds the money. Sentrix keeps no balance: a hold is an authorization nobody has captured or voided, and capture, void and refund are PayPal calls. States of `paypal_status`:

`CREATED` -> `AUTHORIZED` -> `CAPTURED` | `HELD` | `VOIDED`;  `HELD` -> `CAPTURED` | `VOIDED`;  `CAPTURED` -> `PARTIALLY_REFUNDED` -> `REFUNDED`.

## Authorization expiry

PayPal honours an authorization for 29 days. On authorize we store `paypal_authorized_at` and `paypal_authorization_expires_at` (PayPal's `expiration_time`, or 29 days if it is missing).

- The review queue and the Transactions API return `authorization_expires_at`; the review card shows a countdown, red under 72 hours.
- `ExpiringHoldsJob` runs every 15 minutes (Solid Queue, `config/recurring.yml`):
  - 72 hours before the end, each admin and manager gets one high-priority notification (once per hold);
  - 12 hours before the end the system voids the hold, as actor `System`, with the reason in the audit log. Voiding is the safe direction: nobody is charged and the hold is released, as PayPal would do at expiry.
  - The system never captures.
- Capturing an expired authorization is refused with 409 before PayPal is called.

## Refunds

`POST /admin/review_queue/:id/refund` takes an optional `amount`.

- No amount: refund what is left (a full refund when nothing was refunded yet).
- With an amount: a partial refund, status `PARTIALLY_REFUNDED`; the total refunded (`refunded_amount`) never passes the captured amount (422 otherwise). The last refund makes the status `REFUNDED`.
- Request ids to PayPal: the first full refund is `refund-<id>`; any other refund is `refund-<id>-<cents refunded before>-<cents now>`, so a retry of the same refund is the same PayPal request and a different refund is a new one.
- Every refund is audited with the amount and the running total.

## Insufficient merchant balance

If PayPal refuses a refund because the merchant balance cannot cover it (`INSUFFICIENT_FUNDS` and similar issue codes), the API answers 409 "The merchant balance cannot cover this refund. Add funds to the PayPal account and try again." Nothing changes in Sentrix and nothing is written to the audit log.

## Simulated payments are local state only

A simulated payment (ids start with `SIM-`) goes through the real rules, model, AI analyst and limits, but its authorization, capture and refund exist only as Sentrix rows. PayPal is never called and no merchant balance is modelled, so the insufficient-balance path can only be seen with the real sandbox. Simulated holds expire and are voided by the same job.
