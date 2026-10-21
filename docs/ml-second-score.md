# The second risk score

Written 2026-10-21 with the feature. It records what was decided and why; the README has the summary.

## Problem

`RiskRulesProcessor` scores a payment from fixed constants. It ignores the hour, the payment method,
whether the IP address is new and how busy the last hour was, and it cannot say how close a payment
was to the line. An analyst sees rule names but not the shape of the risk.

## Design

| Decision | Choice | Why |
|---|---|---|
| Model | Logistic regression | Exact per-feature explanations (coefficient times distance from the mean), a scorer that is a dozen lines of Ruby, stable and auditable |
| Compared against | Gradient boosting, isolation forest | Same data and split; logistic regression ships unless another model beats it by more than 5 points of recall |
| Role | Second opinion | Can lift success to flagged only; rules keep every block |
| Failure | Fail open to the rules | A missing or broken model file must not stop a payment being evaluated |
| Kill switch | `ML_SCORE_ENABLED=false` | Off without a code change |
| Storage | `ml_score`, `ml_version`, `ml_explanation` on `fraud_evaluations` | Nullable, so old rows are untouched; the version says which model produced a score |

## Features (11)

Log amount, log of amount over the customer's average (capped at 50), first transaction, log of
earlier payments in the last minute and in the last hour, night (00:00 to 06:00 UTC), UPI, bank
transfer, wallet (card is the baseline), new IP address for this customer, untrusted device. Counts
exclude the payment being scored. The order lives in [`ml/features.py`](../ml/features.py) and
[`ml_feature_builder.rb`](../backend/app/services/ml_feature_builder.rb).

## Data and limits

No real labelled fraud exists for this project. [`ml/synthetic.py`](../ml/synthetic.py) generates
customers and payments and draws fraud labels from a hidden logistic function with noise. It includes
fraud the rules miss (a new IP at night, a new IP on UPI or a wallet, bursts over an hour) and honest
traffic the rules flag (large planned purchases). Because the generator is mine, the evaluation shows
the second score can learn that structure; it is not evidence about real fraud. The base rate is 3.4%.

## Reproduce

```
python ml/bundle.py                        # writes ml/kaggle/main.py (git-ignored)
kaggle kernels push -p ml/kaggle           # trains on Kaggle, private kernel
kaggle kernels output <user>/fintech-fraud-second-score -p ml/results
```

Copy `risk_model_v1.json` to `backend/config/ml/` and `ml_golden.json` to
`backend/test/fixtures/files/`. Bump the version in `train.py` and the model file name for a new model.

## Rollout and rollback

Deploy runs the migration (three nullable columns). Rollback is `ML_SCORE_ENABLED=false`; the
columns can stay.
