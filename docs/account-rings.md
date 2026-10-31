# Account and device rings (RG-1)

Fraud rarely stays inside one account. A ring is a set of accounts tied together by devices they share. `AccountRings`
finds it with one recursive Postgres query, and uses it in two places.

## How accounts are linked

- Two accounts are linked when both paid from the same `device_id` inside the last 30 days.
- The link is followed up to 3 hops: account A and C are in one ring when B paid from a device A used and a device C
  used, even if A and C never share a device. The walk is `WITH RECURSIVE` over the (account, device) pairs of recent
  payments; `UNION` plus the depth cap ends it on a cycle.
- A device used by more than 25 accounts (a kiosk, an office machine) is not a link. At most 50 members are returned.
- Index: `index_transactions_on_device_id_and_user_id` (partial, non-blank device ids).

## Where it is used

1. **The AI analyst** gets two more facts, as bands only: `linked_accounts` ("none", "1 other account", "2 to 3 other
   accounts", "4 or more other accounts") and `linked_accounts_voided_by_a_person` ("none" or "2 of 3"). No account id,
   email or device id leaves the server (`test/services/account_rings_test.rb` asserts this). The prompt says a link
   alone is weak, because households share devices, and links to accounts a person voided are strong. The verdict
   timeline may name the signal `linked_accounts`.
2. **The review queue** has a "Linked accounts" button on every case. It calls `GET /api/v1/admin/review_queue/:id/ring`
   (staff only) and lists each linked account with its distance in hops, its payments, how many were captured and how
   many a person voided. It loads on request, so the list of cases never runs the graph query for every row.

The ring does not change a decision by itself. The rules, the model and the agent action policy are as before; the ring
is evidence for the analyst and the reviewer.

## Measured

Synthetic data (32,125 payments, 3,000 accounts, rolled back after the run), local Postgres: the staff detail query p50
39 ms and worst 266 ms over 30 random accounts; the analyst facts p50 24 ms, worst 50 ms. The synthetic rings are short
(two accounts), so this shows the query cost on a table of that size, not on a deep ring. The seeded demo ring (four
customers, one shared device, voided by the reviewer) is found in full (`demo_traffic_test.rb`).

## Limits

- Device ids are what the browser reports; a fraudster who clears them is not linked. IP address is not used as a link
  yet, because many honest customers share one.
- No claim is made that the ring facts improve the analyst's agreement with the labelled cases: the 30-case table
  (`docs/ai-evaluation.md`) has no ring facts, so it is unchanged. Adding labelled ring cases is the next step.
