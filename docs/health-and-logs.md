# Health, logs and warm-up

## Deep health

`GET /api/v1/health/deep` is public and needs no session. It reports:

| Field | Meaning |
|---|---|
| `database` | `up` with the time one `SELECT 1` took, or `down` |
| `queue` | `up` when a Solid Queue worker sent a heartbeat in the last 2 minutes, `no_worker` otherwise, with the number of ready jobs and the age of the oldest |
| `analyst` | AI analyst configured or not, circuit state, time of the last call, last failure reason |
| `status` | `ok`, `degraded` (queue has no worker) or `down` (database unreachable) |

Only a database that is down answers 503. A queue with no worker or an open analyst circuit answers 200 with
`degraded` or the circuit state, because payments are still judged by the rules and the model in both cases.
`/api/v1/health` (the old, short answer, used by the Help page) and `/up` (Render's health check) are unchanged.

The analyst fields are per process, like the circuit breaker itself (`docs/analyst-resilience.md`): after a restart
`last_call_at` is empty until the next payment is scored.

## Logs

In production (or with `LOG_FORMAT=json`) every log line is one JSON object with `time`, `level`, `request_id`
and either `message` or fields. The request id is the same value the response carries in `X-Request-Id`, so a
failing request seen in the browser can be found in the Render log. Each finished request writes one line:

```json
{"time":"2026-10-30T16:03:20.526Z","level":"info","request_id":"9c80c577-92f0-4ebc-beee-e0d8ab1c46cf","event":"request","method":"GET","path":"/api/v1/health/deep","route":"Api::V1::HealthController#deep","status":200,"duration_ms":920.1,"db_ms":107.0}
```

`user_id` is added for a signed-in request. Parameters and bodies are not logged (the parameter filter stays on).

## Warm-up ping

`.github/workflows/warm-up.yml` runs every 10 minutes (and by hand with `gh workflow run warm-up.yml`). Render's
free plan stops an idle service after 15 minutes; the ping keeps it awake for visitors and judges. It calls the deep
health with up to three tries of 90 seconds (a cold start takes about a minute), then calls the health route
through the Vercel proxy. A non-200 answer fails the run, and GitHub emails the owner. Scheduled runs are
best-effort and can be a few minutes late; GitHub also pauses scheduled workflows in a repository with no
activity for 60 days.
