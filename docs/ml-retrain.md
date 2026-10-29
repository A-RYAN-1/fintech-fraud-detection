# Retraining the second score on reviewer labels (ML-1)

Written 2026-10-29. The shipped model stays `v1`; this page records the procedure, the result and why.

## What it does

Every time a person captures or voids a held payment, the evaluation stores that decision as a label
([feedback loop](feedback-loop.md)) together with the feature vector the model saw (`ml_features`) and the
model version (`ml_version`). `rake ml:export` writes those rows to JSON, and `ml/retrain.py` runs on Kaggle to
retrain and compare against the shipped model on one fixed hold-out. A candidate ships only if it clears every
gate; otherwise `v1` stays and nothing in the app changes.

## Gates

| Gate | Threshold |
|---|---|
| PR-AUC gain on the hold-out | at least 0.02 |
| ROC-AUC gain on the hold-out, 5th percentile of a 1,000-resample paired bootstrap | above 0 |
| PR-AUC loss on the original synthetic test set (seed 33) | at most 0.01 |
| Rows of each class in train and in hold-out | at least 20 |

The hold-out is every row whose hashed key ends in 7, 8 or 9 (30%), so all models see the same rows on every run.
`v1` is scored from its own JSON in Python; the maximum difference from the score stored by Rails was 0.0, which
also confirms the two implementations agree on real rows.

Two candidates: logistic regression on the labels alone, and logistic regression on the 100,000 synthetic training
rows plus the labelled rows, each weighted 20 times.

## Result (run 2026-10-29, Kaggle, private kernel)

Data: `rake demo:traffic` with `SEED=42 CUSTOMERS=160 RINGS=10 DAYS=14 LEAVE_OPEN=0`: 1,126 payments, 936 with a
human label (80 block, 856 approve). Train 628 rows (48 block), hold-out 308 rows (32 block).

| Model | Hold-out ROC-AUC | Hold-out PR-AUC | Hold-out log loss | Synthetic test PR-AUC | Passes |
|---|---|---|---|---|---|
| v1 (shipped) | 1.000 | 1.000 | 0.219 | 0.112 | - |
| Labels only | 1.000 | 1.000 | 0.008 | 0.051 | no |
| Synthetic plus labels | 1.000 | 1.000 | 0.127 | 0.092 | no |

Decision: keep v1. Full output: [`ml/results/retrain/compare.json`](../ml/results/retrain/compare.json).

## What the result means

- **The numbers are synthetic.** Production has no human labels, and these labels are the scripted decisions of
  the demo reviewer (a ring payment is voided, a traveller is approved). They are a function of the same features
  the model reads, so `v1` already separates them perfectly. A perfect score says the pipeline works end to end,
  not that the model detects fraud.
- **The hold-out cannot discriminate.** With both models at 1.000, the gains are 0 and no candidate can pass. The
  gate is doing its job: it refuses to ship a replacement without evidence.
- **Better log loss on the labels is not a reason to ship.** The labels-only model is better calibrated on the
  demo rows (0.008 against 0.219) but loses more than half the PR-AUC on the broader synthetic set, because it was
  fitted to two scripted patterns. The blended model loses 0.02 there, over the 0.01 allowance.
- **Selection bias.** Only held payments get a human label, so a model trained on them sees the flagged slice,
  not all traffic.

## Reproduce

```
docker compose exec api bin/rails demo:traffic        # SEED, CUSTOMERS, RINGS, DAYS, LEAVE_OPEN
docker compose exec api bin/rails ml:export OUT=/tmp/ml_training.json
python ml/bundle.py retrain                           # writes ml/kaggle-retrain/main.py (git-ignored)
# put ml_training.json and risk_model_v1.json in ml/kaggle-retrain/data/, then
kaggle datasets create -p ml/kaggle-retrain/data      # or `version` after the first time
kaggle kernels push -p ml/kaggle-retrain
kaggle kernels output <user>/fintech-fraud-retrain -p ml/results/retrain
```

Training runs on Kaggle only. When real reviewers have labelled enough held payments (at least 20 of each class in
both splits), export from production and run the same kernel; if a candidate passes, `risk_model_v2.json` is
written next to `compare.json`. Copy it to `backend/config/ml/` and point `MlRiskScorer::MODEL_PATH` at it, replace
`backend/test/fixtures/files/ml_golden.json` with vectors scored by the new model, and ship. `ml_version` on each
evaluation then separates old and new scores.
