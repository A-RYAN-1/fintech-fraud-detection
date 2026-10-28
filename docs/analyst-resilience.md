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
