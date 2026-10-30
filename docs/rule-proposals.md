# Rule proposals with a backtest

When a person overrides the rules, the agent drafts one change to one rule and tests it on every stored payment before anyone sees it. The agent never edits a live rule. Only an admin accepting a draft writes `risk_rule_settings`.

## What starts a draft

A person's capture or void of a held payment is a label (see `feedback-loop.md`). A draft starts when that label disagrees with the rules:

| Kind | Rules said | Person said |
|---|---|---|
| false alarm | held or blocked | approve |
| miss | approved | block |

The draft runs in `RuleProposalJob`, after the decision is saved and outside the payment lock. A failure there cannot undo or delay the decision. Staff can also ask for a draft from a decided payment (`POST /admin/rule_proposals`); the answer says why when none is possible.

## How a change is chosen

Candidates are the score of each rule that fired and the thresholds. A candidate is kept only if it:

1. is a legal rule value (range and ordering, the same validation as a manual edit);
2. changes the outcome of the payment that started it;
3. creates no new miss, when the trigger was a false alarm.

The reversible action comes first. A missed payment moves to FLAGGED (held for a person), never straight to BLOCKED. A blocked false alarm moves to FLAGGED, not to approved. Among the kept candidates the one with the fewest misses, then fewest false alarms, then fewest payments changing tier, then the smallest change wins.

## The backtest

`RuleBacktest` replays stored payments through `RiskRulesProcessor` twice, with today's values and with the candidate. Each payment gets the history it had when it was made: the user's average and count of earlier approved payments, the payments inside the velocity window, and the trusted device. The model's lift from approved to flagged is kept as stored. It writes nothing.

The report shows approved, held and blocked counts before and after, false alarms and misses before and after, the payments that would change tier, and a fidelity line: how many stored outcomes the replay of today's rules reproduces. Two approximations are stated on the page: stats follow what happened rather than what the change would have caused, and the trusted device is the user's first device today. Replay covers the latest 20,000 payments.

## Accepting

`POST /admin/rule_proposals/:id/accept` (admin). If the rule changed since the draft, the draft is marked superseded and the call returns 409. Otherwise it writes the setting, audits `RISK_RULE_CHANGED` with the admin as actor and the draft id, and clears the rule cache. `reject` records the decision and changes nothing. Drafting is audited as `RULE_PROPOSAL_DRAFTED` by the agent.

Pages: Rule Changes (`/admin/rules`), read by every staff role, decided by admins.
