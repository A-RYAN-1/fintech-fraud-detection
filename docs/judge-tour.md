# Public tour

`/tour` is the page a first-time visitor sees: a guest who opens the site root is sent there, and the sign-in card links to it. It needs no account.

What it shows, top to bottom:

1. What Sentrix is, with live counts from the demo (last 7 days) and a drawn example of a reviewer's case card.
2. Why it exists: three problems, in plain words.
3. How a payment is decided: the six steps from `config/pipeline.ts`, each with its live count.
4. What the AI analyst may and may never do.
5. Agent mandates, with a drawn example.
6. One-click sign-in as the customer, reviewer or admin sandbox account, with what to look at first.
7. Where each judging criterion shows in the app, and what changed since 1 October.

## Live counts

`GET /api/v1/public/pipeline` (no sign-in) returns `window_days` and the same `pipeline` counts staff see on Home, over every payment of the last 7 days (`HomeSummary.public_pipeline`). It returns counts only: no amounts, people, emails or ids. The answer is cached for one minute and falls under the general per-address rate limit.

The two drawn examples (case card, mandate) are illustrations and say so on the page; every number that is live is labelled live.
