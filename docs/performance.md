# Performance

Measured numbers for the query and cache work (PG-3) and the load test (PG-5).

## Lists: indexes and keyset pages (PG-3)

The customer's payments list and the review queue read newest first. Before, both used the single-column indexes
(`created_at`, `user_id`, `paypal_status`), so the database walked `created_at` backwards and discarded rows that were
not the customer's (or not held) until it had ten. Migration `20261030150000` adds
`(user_id, created_at DESC, id DESC)` and `(paypal_status, created_at DESC, id DESC)` and drops the single-column
`user_id` index, which is the prefix of the first. Both lists also take `cursor=` (keyset paging, `lib/keyset.rb`):
the next page is "older than the last row you saw", found in the index, so page 2,500 costs what page 1 costs.

How it was measured: `backend/db/perf/explain_lists.sql`, run on the Postgres 16 container of `compose.yaml` in a
scratch schema, 300,000 generated payments over 200 customers (one customer holds 30,000, a deliberately extreme
case), 2% held. `EXPLAIN (ANALYZE, BUFFERS)` on the exact query the controllers issue, before and after the indexes.
Data is random, so milliseconds move between runs by about a factor of two; the buffer counts and the plan shapes
are the result. One run:

| Query | Before | After |
|---|---|---|
| Customer list, first page | 94 buffers, 0.17 ms (index scan on `created_at`, 64 rows filtered out) | 13 buffers, 0.04 ms (index scan on the composite) |
| Review queue, first page (held payments) | 640 buffers, 0.72 ms (553 rows read and discarded) | 13 buffers, 0.06 ms |
| Customer list, page 2,500 by offset (25,000 rows skipped) | 402 buffers, 10.4 ms, sort spilled 2.4 MB to disk | unchanged by the index: 554 buffers, 12.1 ms, same disk sort |
| Same depth by keyset (`cursor=`) | not available | 14 buffers, 0.06 ms, no sort |

The review queue gain grows as held payments get rarer (the old plan read every newer payment that was not held).
Offset paging cannot be fixed by an index: it still reads and sorts everything it skips. That is why the History page
(`Show older`) and the Review queue (`Show older`) now use the cursor. The numbered `page=` parameter still works for
the other admin lists and for API clients. Index sizes at this volume: table 29 MB, new indexes 14 MB and 16 MB.

The review queue also had a query per row (the pending approval request was looked up again for every held payment
that had none). A test now counts queries and fails if the count grows with the page size, for both lists.

The review queue showed only its first ten held payments with no way to reach the rest; "Show older" fixes that too.

## Analytics cache (PG-3)

Insights (staff) and My Spending (customer) are sums over many rows. Their results are cached for 60 seconds in
`Rails.cache`, which is `solid_cache` in production (table `solid_cache_entries` in the primary database, shared by
every process, kept across restarts, no new service). The key carries a version that any change to a payment or its
evaluation replaces (`AnalyticsCache.bump`), so a number is never older than the last payment, and at most 60 seconds
old otherwise. My Spending is cached per customer. A cache that fails is skipped, not an error. Tests cover a hit,
separate entries per customer and period, invalidation by a new payment and by a changed evaluation, expiry at 60
seconds, and a broken cache.

## Load test (PG-5)

Everything here ran on one laptop. Nothing was sent to the deployed service, Neon or the PayPal sandbox.

**Method.** The production Docker image of the API (`docker build -t sentrix-api-loadtest backend`) runs in a container
with a CPU and memory limit, one Puma worker with 3 threads, Solid Queue inside Puma, its own database in the compose
Postgres, PayPal simulated, the AI analyst off (no key), so the numbers are Sentrix's own work. k6 runs in a second
container on the same Docker network. Traffic is a constant arrival rate (requests per second), 30 s per step, 40 seeded
customers and a seeded history (about 360 payments from `demo:traffic`). Sessions are made once in `setup()`: a login
is a bcrypt hash, and a first version that logged in per virtual user measured bcrypt, not the app. Files:
`backend/loadtest/` (`run.sh`, `k6.js`, `seed.rb`); raw k6 summaries and logs in `backend/loadtest/results/<tag>/`.
Reproduce from the repo root with Git Bash: `docker compose up -d db`, build the image, then
`CPUS=0.5 TAG=half-cpu bash backend/loadtest/run.sh` (about 9 minutes).

`RATE_LIMITS=off` (read in `config/initializers/throttling.rb`) turns the limits off for the capacity phase only: the
shipped limits allow about 2 requests a second from one address, which would hide the app. The boot log says so when it
is set. It must never be set on a deployed service.

**Workloads.** `lists`: Home, payments by keyset, My Spending and deep health as a customer. `staff`: review queue,
Insights and Feedback as the reviewer. `scoring`: `POST /payments/simulate`, the whole pipeline (rules, risk model,
limits, capture or hold or void) writing rows.

### Capacity at 0.5 CPU, 512 MB

Latency in milliseconds per step (median / p95 / p99). Every step in this table: 0 failed requests, 0 server errors.

| Workload | 5 rps | 10 rps | 20 rps | 40 rps |
|---|---|---|---|---|
| lists | 13 / 26 / 34 | 11 / 24 / 40 | 10 / 23 / 28 | 9 / 19 / 32 |
| staff | 13 / 24 / 30 | 13 / 23 / 31 | 12 / 22 / 25 | 10 / 18 / 46 |

| Scoring | 2 rps | 5 rps | 10 rps | 20 rps |
|---|---|---|---|---|
| median / p95 / p99 | 71 / 98 / 105 | 70 / 102 / 111 | 78 / 132 / 219 | 87 / 444 / 550 |

Memory after the run: 288 MiB of 512 MiB. Error lines in the app log: 0. The lists and staff paths are flat up to 40
requests a second; scoring writes rows and starts to queue at 20 a second (p95 98 ms at 2 rps, 444 ms at 20 rps).

**Where it saturates.** A second run pushed past those rates (`half-cpu-knee`, limits off): lists at 80 rps answered
about 75 a second with p95 3.9 s (requests queue behind the one worker), staff at 80 rps about 59 a second with p95 4.7 s,
scoring at 30 rps about 21 a second with p95 13.6 s. That puts the ceiling of one worker at 0.5 CPU near 40 to 75
requests a second for reads and about 20 for scoring. k6 reported dropped iterations (it could not start arrivals
fast enough) and still 0 server errors: the service slows down, it does not fail. Steps in that run follow each other
with 5 s between, so later steps carry the previous step's backlog (the 40 and 60 rps scoring steps, p50 about 50 s,
are queue drain, not steady state); read only the first overloaded step of each workload as the knee.

### Capacity at 0.1 CPU (about the Render free instance)

Same image and traffic, `CPUS=0.1` (`tenth-cpu`). Median / p95 / p99 in ms; 0 failed requests and 0 server errors in
every step.

| Workload | Step | Median / p95 / p99 |
|---|---|---|
| lists | 2 rps | 11 / 101 / 180 |
| lists | 5 rps | 9 / 90 / 94 |
| lists | 10 rps | 294 / 992 / 1,094 (queueing starts) |
| lists | 20 rps | 7,645 / 12,345 / 12,892 (saturated) |
| staff | 5 rps | 9 / 14 / 97 |
| staff | 10 rps | 95 / 795 / 900 (queueing starts) |
| scoring | 1 rps | 214 / 309 / 588 |
| scoring | 2 rps | 224 / 319 / 445 |
| scoring | 5 rps | 7,697 / 12,100 / 12,713 (saturated) |

On a tenth of a CPU the app is comfortable at about 5 requests a second for reads and 2 a second for scoring, and
saturates between those and double. Render's free plan is a shared fraction of a CPU, not a fixed quota, so this is
an approximation of it, not a measurement of it.

### Limits found (rate limits as shipped, 0.5 CPU, run `half-cpu`)

One client from one address, in a single 23 s run:

| Probe | Sent | Answered | Refused (429) |
|---|---|---|---|
| Scoring burst (limit 20 a minute) | 30 | 20 | 10 |
| Login guesses (limit 20 a minute) | 30 | 19 (one login was used by setup) | 11 |
| Read flood for 20 s (limit 600 per 5 minutes) | 14,478 | 539 | 13,939 |

All 13,960 refusals carried `Retry-After` and the JSON error body (`well_formed_429` equals `limited_429`), and there
were 0 server errors: the limiter answers at about 600 requests a second without touching the app, so a flood from one
address never reaches the worker. The limits sit far below the capacity above (20 scoring requests a minute against
about 20 a second), so for one user the limiter, not the CPU, is what stops a flood.

### What this does not show

One machine, synthetic traffic, a local Postgres on the same host, PayPal simulated and the AI analyst off (a real
analyst call adds its own latency, bounded by its timeout and circuit breaker). It says nothing about the deployed
service, about many addresses at once, or about a database over the network. No capacity beyond these measurements is
claimed.
