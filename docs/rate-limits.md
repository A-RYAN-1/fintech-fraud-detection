# Rate limits

Enforced by Rack::Attack (`backend/config/initializers/throttling.rb`) before a request reaches a controller. A rejected request gets HTTP 429, a `Retry-After` header and the usual JSON envelope with `error: "rate_limited"`.

| Rule | Key | Limit |
|---|---|---|
| general | client address | 600 per 5 minutes (`/up` is exempt) |
| login by address | client address | 20 per minute |
| login by email | email, lower-cased and trimmed | 5 per minute, whatever the address |
| register | client address | 10 per hour |
| payment (create and authorize an order) | signed-in user, else address | 10 per minute |
| scoring (`POST /transactions`) | signed-in user, else address | 20 per minute |
| admin action (approve, void, refund) | signed-in user | 30 per minute |

The limiter sits behind the session store so it can key on the signed-in user; users behind one shared address do not share a payment limit.

Counters are held in this process's memory. The API runs as one process on the free Render plan, so that is the whole picture; they reset on a restart or a cold start. With more than one instance, each instance would count on its own and the effective limit would be higher; the fix then is a shared store (Redis or solid_cache). The load test (`docs/performance.md`, when added) reports what the limits do under load.

### Which address is counted

The API is behind Cloudflare (Render's edge), whose address changes per request, so `config/initializers/trusted_proxies.rb` treats Cloudflare's published ranges as proxies and `request.remote_ip` is the real client. Browser traffic that goes through the Vercel proxy can still share Vercel's egress address, so the per-address rules are the coarse ones (hence 20 logins and 600 requests, not tighter) and the per-email and per-user rules are the precise ones. A live check on 2026-10-27 showed the per-email rule returning 429 after five attempts; the first per-address version never fired because of the changing edge address, which is what this change fixes.
