# Similar past cases

For a held payment, a reviewer can ask for the three nearest cases that a person has already decided, each with what the person decided (approved or voided). It is evidence next to the case, not a recommendation: it never changes the payment, the rules decision or the AI verdict.

## How it works

1. **One vector per decided case.** When a person approves or voids a payment, `CaseEmbeddingJob` embeds the case and stores one row in `case_embeddings` (pgvector, `vector(768)`, HNSW index on cosine distance). The job runs after the decision is saved and outside the payment lock; if it fails the decision is unaffected and `rake similar_cases:backfill` fills the gap later. A later refund that flips the label needs no re-embedding: the outcome is read from `fraud_evaluations` at query time.
2. **What is embedded.** The same facts-only payload the verdict and Ask the analyst use (`AskAnalyst#facts`), written as sorted `key: value` lines: amount band, payment method, time of day, bands, flags, rule names, model reason labels, account ring bands. No user id, email, IP address, device id or payment id leaves the server; a test asserts it.
3. **The model.** Gemini `gemini-embedding-001` on the free tier, called remotely through `GeminiClient#embed` (768 dimensions, task type `SEMANTIC_SIMILARITY`). Nothing runs locally. The call goes through the same token bucket and circuit breaker as the analyst (`AnalystGuard`), so a failing or rate-limited API is skipped, not retried into a storm.
4. **The query.** `GET /api/v1/admin/review_queue/:id/similar` embeds the case being viewed and returns the nearest three other decided cases by cosine distance: `{ source, matches: [{ payment_id, amount_band_usd, rules_triggered, human_outcome, decided_at, distance }] }`. Staff only (analyst, reviewer, admin); a customer gets 403, an unknown case 404. It shares the `ask_analyst` rate limit (6 a minute per person).
5. **Fallback.** If embeddings are unavailable (analyst off, circuit open, bucket empty, call failed) or no vector exists yet, the endpoint returns a rules-based match with `source: "rules"` and `distance: null`: decided cases that fired the same set of rules in the same amount band, newest first. The panel says it is a rules-based match, so a fallback is never presented as the embedding search.

## Frontend

`SimilarCasesPanel` sits in each case card. Nothing is requested until the button is pressed. It lists outcome, amount band, rules and distance for each match, labels a rules-based match, and says so when no decided case is similar yet.

## Infrastructure

- **Neon free** has the `vector` extension (checked 2026-11-01 on the production database: `pg_available_extensions` lists `vector` 0.8.6, Postgres 18). The migration runs `CREATE EXTENSION vector`.
- **Local Docker and CI** use the `pgvector/pgvector:pg16` image instead of `postgres:16-alpine` (`compose.yaml`, `.github/workflows/ci.yml`). Existing local volumes were created by the alpine image; if the database will not start after the switch, run `docker compose down -v` once to recreate it (this drops local data).
- The `neighbor` gem provides the `vector` column type, schema dump and the `has_neighbors` model hook. Queries use plain SQL (`<=>`).

## Leave-one-out check

`rake similar_cases:check` (no Gemini calls) takes each decided case that has a vector, finds its three nearest other decided cases, and compares their majority outcome with the person's outcome. It prints the sample size, how many agreed, and the baseline of always guessing the majority outcome. With fewer than 30 cases it prints that the sample is too small to claim any accuracy.

Result on production (2026-11-01, after `rake similar_cases:backfill` embedded all 9 decided cases): sample 9 (6 voided, 3 approved); the majority outcome of the 3 nearest agreed with the person in 6 of 9 (0.667), and always guessing "voided" also scores 6 of 9 (0.667). So there is no measured lift over the baseline, and 9 cases is below the 30 needed to say anything about accuracy. The honest claim is that the feature retrieves nearby decided cases with their human outcome; it is not claimed to predict the outcome. Live, `/similar` on held cases now answers with `source: embedding` and distances of about 0.015 to 0.04.

## Tests

- `test/services/similar_cases_test.rb`: text is stable, sorted and carries no identifier; one vector per decided case and none for an undecided one; failure and open circuit store nothing; nearest three come back closest first with the human outcome and never the case itself or an undecided case; rules fallback on failure, when the analyst is off, and when the embedding search finds nothing; the job indexes a decided case and ignores a missing one.
- `test/services/similar_cases_check_test.rb`: empty store claims nothing; agreement, baseline, sample and the small-sample flag.
- `test/services/gemini_client_test.rb`: the embedding request uses the free model and 768 dimensions; wrong size and unreadable JSON are errors.
- `test/integration/review_queue_test.rb`: staff only, read only, rules fallback, 404.
- `SimilarCasesPanel.test.tsx`: no request until clicked, matches with outcome and distance, rules label, empty and error states.
