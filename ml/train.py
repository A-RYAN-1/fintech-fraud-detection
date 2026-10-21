"""Train and compare the second-score candidates, then export the logistic regression model.

Runs on Kaggle (see kaggle/README.md); nothing here is meant to run on a laptop. Output goes to
OUT_DIR: risk_model_v1.json (what the Rails scorer loads), metrics.json (every number in the
README), ml_golden.json (vectors the Rails test must reproduce).
"""
import json
import os
from datetime import date

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.preprocessing import StandardScaler

from features import FEATURES
from rules import FLAGGED
from synthetic import generate

OUT_DIR = os.environ.get("OUT_DIR", ".")
MODEL_VERSION = "v1"
FPR_HEADROOM = 0.02  # the second score may add at most 2 points of false positives over the rules


def confusion(flag, y):
    tp = int((flag & (y == 1)).sum())
    fp = int((flag & (y == 0)).sum())
    fn = int((~flag & (y == 1)).sum())
    return {
        "precision": round(tp / max(tp + fp, 1), 4),
        "recall": round(tp / max(tp + fn, 1), 4),
        "false_positive_rate": round(fp / max(int((y == 0).sum()), 1), 4),
        "flag_rate": round(float(flag.mean()), 4),
    }


def pick_threshold(score, rules_flag, y):
    """Lowest cut-off whose combined (rules OR model) false-positive rate stays within the headroom."""
    base_fpr = (rules_flag & (y == 0)).sum() / (y == 0).sum()
    best = None
    for t in np.unique(np.quantile(score, np.linspace(0.5, 0.999, 400))):
        fpr = ((rules_flag | (score >= t)) & (y == 0)).sum() / (y == 0).sum()
        if fpr <= base_fpr + FPR_HEADROOM:
            best = float(t)
            break
    return best if best is not None else float(score.max()) + 1.0


def main():
    X_tr, y_tr, _ = generate(100_000, seed=11)
    X_va, y_va, r_va = generate(40_000, seed=22)
    X_te, y_te, r_te = generate(40_000, seed=33)
    rules_va, rules_te = r_va >= FLAGGED, r_te >= FLAGGED

    scaler = StandardScaler().fit(X_tr)
    lr = LogisticRegression(C=1.0, max_iter=1000).fit(scaler.transform(X_tr), y_tr)
    gbm = HistGradientBoostingClassifier(max_depth=4, max_iter=200, random_state=0).fit(X_tr, y_tr)
    iso = IsolationForest(n_estimators=200, random_state=0).fit(X_tr)

    scorers = {
        "logistic_regression": lambda X: lr.predict_proba(scaler.transform(X))[:, 1],
        "gradient_boosting": lambda X: gbm.predict_proba(X)[:, 1],
        "isolation_forest": lambda X: -iso.score_samples(X),
    }

    metrics = {
        "generated": str(date.today()),
        "data": "synthetic, seeds 11/22/33; train 100000, validation 40000, test 40000",
        "fraud_rate_test": round(float(y_te.mean()), 4),
        "rules_alone": confusion(rules_te, y_te),
        "rules_pr_auc": round(float(average_precision_score(y_te, r_te)), 4),
        "models": {},
    }
    thresholds = {}
    for name, fn in scorers.items():
        s_va, s_te = fn(X_va), fn(X_te)
        t = pick_threshold(s_va, rules_va, y_va)
        thresholds[name] = t
        metrics["models"][name] = {
            "pr_auc": round(float(average_precision_score(y_te, s_te)), 4),
            "threshold": round(t, 4),
            "model_alone": confusion(s_te >= t, y_te),
            "rules_or_model": confusion(rules_te | (s_te >= t), y_te),
        }

    lr_recall = metrics["models"]["logistic_regression"]["rules_or_model"]["recall"]
    gbm_recall = metrics["models"]["gradient_boosting"]["rules_or_model"]["recall"]
    metrics["ship"] = "logistic_regression" if gbm_recall - lr_recall <= 0.05 else "review: gradient_boosting is clearly better"

    model = {
        "version": MODEL_VERSION,
        "type": "logistic_regression",
        "trained_on": "synthetic labelled transactions (ml/synthetic.py), not real fraud data",
        "features": FEATURES,
        "mean": scaler.mean_.round(6).tolist(),
        "scale": scaler.scale_.round(6).tolist(),
        "coef": lr.coef_[0].round(6).tolist(),
        "intercept": round(float(lr.intercept_[0]), 6),
        "flag_threshold": round(thresholds["logistic_regression"], 6),
    }
    golden = []
    for i in range(0, 200, 40):
        golden.append({"features": X_te[i].round(6).tolist(), "probability": round(float(scorers["logistic_regression"](X_te[i:i + 1])[0]), 6)})

    for name, payload in (("risk_model_v1.json", model), ("metrics.json", metrics), ("ml_golden.json", golden)):
        with open(os.path.join(OUT_DIR, name), "w") as f:
            json.dump(payload, f, indent=2)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
