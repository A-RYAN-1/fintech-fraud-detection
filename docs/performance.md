# Performance

Measured numbers for the query and cache work (PG-3). The load test (PG-5) adds its section to this file.

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
