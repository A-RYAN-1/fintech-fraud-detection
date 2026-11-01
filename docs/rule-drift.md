# Rule false alarms

The Feedback page already shows how often each signal (rules, model, AI analyst) agrees with the human decision. This adds the view per rule: for each rule, how often a person approved a payment it fired on, which is a false alarm for that rule.

## What it shows

`GET /api/v1/admin/feedback` gains `rule_precision`, one row per rule that has fired on a decided payment, most fired first:

- `fired`: decided payments the rule fired on.
- `human_approved` and `false_alarm_rate`: how many a person approved, and the share.
- `recent` and `earlier`: the same counts for decisions in the last 7 days and before that, so a rule that is getting noisier shows as a rising recent rate.
- `noisy`: true once the rule has fired on at least 5 decided payments and a person approved at least half of them.

A decided payment is one a person approved or voided while it was held, or a captured payment later fully refunded (the same labels as the rest of the feedback loop). Payments the agent acted on alone are not labels.

## What it does not do

It counts only. It does not change a rule, does not propose one, and makes no claim about accuracy: a person approving a flagged payment is a false alarm for the rule only in the sense that the person disagreed. The rule-change proposal with backtest (FF-H7) is still the way a rule changes, and an admin accepts it.

## Frontend

A "Rule false alarms" table on the Feedback page between agreement by day and the disagreement list, with a Noisy badge and the reading rule under the table.

## Tests

- `test/services/feedback_report_test.rb`: counts per rule, recent against earlier, ordering, the noisy flag, and no flag below five decided payments.
- `FeedbackPage.test.tsx`: the rule row, the Noisy badge and the recent window.
