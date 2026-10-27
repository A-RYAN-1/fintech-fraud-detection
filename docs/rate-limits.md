# Rate limits

Enforced by Rack::Attack (`backend/config/initializers/throttling.rb`) before a request reaches a controller. A rejected request gets HTTP 429, a `Retry-After` header and the usual JSON envelope with `error: "rate_limited"`.

| Rule | Key | Limit |
|---|---|---|
| general | client address | 300 per 5 minutes (`/up` is exempt) |
| login by address | client address | 5 per minute |
| login by email | email, lower-cased and trimmed | 5 per minute, whatever the address |
| register | client address | 10 per hour |
| payment (create and authorize an order) | signed-in user, else address | 10 per minute |
| scoring (`POST /transactions`) | signed-in user, else address | 20 per minute |
| admin action (approve, void, refund) | signed-in user | 30 per minute |

The limiter sits behind the session store so it can key on the signed-in user; users behind one shared address do not share a payment limit.

Counters are held in this process's memory. The API runs as one process on the free Render plan, so that is the whole picture; they reset on a restart or a cold start. With more than one instance, each instance would count on its own and the effective limit would be higher; the fix then is a shared store (Redis or solid_cache). The load test (`docs/performance.md`, when added) reports what the limits do under load.
