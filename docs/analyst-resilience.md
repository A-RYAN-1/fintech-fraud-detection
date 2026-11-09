# AI analyst resilience

The AI analyst is advisory. A slow or failing Gemini must never slow down or fail a payment, so every call goes through `AnalystGuard` and `AiAnalyst`.

| Mechanism | Setting (env, default) | Behaviour |
|---|---|---|
| Token bucket | `AI_BUCKET_CAPACITY` 10, `AI_BUCKET_REFILL_PER_MINUTE` 10 | A burst of at most 10 calls, refilled at 10 a minute (under the free tier's quota). An empty bucket skips the analyst at once (`rate_limited`) |
| Circuit breaker | `AI_BREAKER_FAILURES` 5, `AI_BREAKER_COOLDOWN_SECONDS` 60 | 5 failures in a row open the circuit; calls are skipped (`circuit_open`) with no network wait. After the cooldown one probe is let through (half open): success closes the circuit, failure reopens it |
| Retry cap | `MAX_RETRIES` 1, budget 3 s | One retry for a quick 429 or 5xx, after a backoff of 0.4 s (or `Retry-After`, never more than 2 s) plus up to 0.2 s of jitter. A timeout or a 4xx other than 429 is never retried. A retry costs a token and is not allowed once the circuit is open |
| Call timeout | 8 s read, 3 s connect | Unchanged. Worst case for one payment: 3 s of quick failures, 2 s backoff, one 8 s call |

A skipped or failed call returns no verdict and the rules and model decide alone (`AgentActionPolicy` is unchanged: the AI can only confirm or escalate). The guard counts one success or one failure per payment, not per attempt.

`GET /api/v1/admin/analyst_status` (staff) shows the state: `enabled`, `model`, `state` (closed, open, half_open), `consecutive_failures`, `retry_in_seconds`, `tokens`, `capacity`, `last_failure`, and counters `calls`, `successes`, `failures`, `retries`, `skipped_open`, `skipped_rate_limited`.

## Limits

State lives in the Puma process (one Render free instance), guarded by a mutex. With several instances each would have its own bucket and breaker; the numbers above are per instance. State resets on a deploy or restart.

## Fallback model

The Gemini free tier counts requests per model per day (20 a day for the preview models), so one busy day can use up a model. `GEMINI_FALLBACK_MODELS` (comma separated) lists models to try, in order, when the main model (`GEMINI_MODEL`) refuses a call with 429, 503 or 404. The same facts-only request goes to the next model, and the verdict, answer or narrative records the model that answered. A timeout or any other error does not move to the next model; when every model refuses, the analyst is skipped as before and the rules decision stands alone.

## Timeouts

The verdict is part of the payment path, so its Gemini call keeps the 8 second timeout. Ask the analyst and the case narrative run only when a reviewer clicks and write longer text, so they may wait up to 20 seconds (`AiAnalyst::INTERACTIVE_TIMEOUT`) before the page shows the rules-only text instead.
