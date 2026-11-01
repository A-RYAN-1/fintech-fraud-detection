# Analyst grounding check

The AI analyst writes three kinds of text about a case: the verdict explanation and timeline, the case narrative and the answers to "why this verdict" and "what would change it". All of them are checked. The analyst sees only a facts-only payload (bands, flags, rule names, model labels), so anything it writes that is not in that payload was made up. This check finds the made-up parts mechanically, with no second model call.

## What it checks

`AnalystGrounding.check(texts, facts)` raises an issue for:

| Kind | Meaning |
|---|---|
| `unknown_number` | A number that is not in the facts: an amount, a risk score, a count, a percentage that is not the model probability. `1,000` matches the band "250 to 1,000"; `73%` matches a model probability of `0.73`. |
| `unknown_rule` | A rule name (UPPER_SNAKE) that did not fire on this case. |
| `identifier` | An e-mail address, IP address, UUID or long hex string. The payload never contains one, so the text must not. The issue names the kind, not the value. |

## What happens on a failure

- **Case narrative** and **Ask the analyst**: the AI text is replaced by the fixed rules-only text, `source` becomes `rules`, and the response carries `grounding: { status: "rejected", issues: [...] }`. The panel says the AI draft was replaced and what it cited. The narrative audit row records the rejection.
- **Verdict** (explanation and timeline details): the action and confidence stay, because the AI can only escalate a payment to a person and never lifts a hold, so a wrong action costs a human look at worst. The explanation is replaced by a sentence built from the facts (rules decision, risk score, rules fired), the timeline is dropped, and the stored verdict carries `grounding: { status: "rejected", issues: [...] }`. The review card shows the same one-line note.
- A text that passes carries `grounding: { status: "passed" }` and the panel says it was checked.
- When no AI text was produced (analyst off, circuit open, failed call) the status is `not_applicable` and the panel shows nothing extra.

The check is strict on purpose. A rejected draft costs nothing: the reviewer gets the template, which is built from the same facts. It does not judge wording or reasoning; it proves only that the text cites nothing outside the facts.

## Measured

`test/services/analyst_grounding_test.rb` holds a corpus written for this check: 10 faithful texts (what an analyst could write from the facts) and 12 planted fabrications (invented amounts, scores, counts, percentages, probabilities, rule names, an e-mail, an IP address, a UUID, a long hash).

| | Result |
|---|---|
| Faithful texts accepted | 10 of 10 |
| Planted fabrications rejected, with the expected kind | 12 of 12 |

What this does and does not show: the corpus is ours and synthetic. It shows the checker catches these kinds of invention; it is not a measure of how often the model invents, and 22 cases are too few to give a rate. The live count is `bin/rails analyst:grounding_report` (read-only; counts saved narratives by passed, rejected or not applicable). Until AI drafts have run on production, claim nothing about the rejection rate.

## Not covered

- Wording that is false without a number or rule name ("the customer is a fraudster") passes; the prompts forbid it but the check does not.
- A number that happens to equal one in the facts passes even if it means something else.
