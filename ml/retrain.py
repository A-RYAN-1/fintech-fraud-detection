"""Retrain the second score on human labels and compare it with the shipped model on the same hold-out set.

Runs on Kaggle (see docs/ml-retrain.md); nothing here is meant to run on a laptop. Inputs are a private
Kaggle dataset holding ml_training.json (from `rake ml:export`) and risk_model_v1.json. Output goes to
OUT_DIR: compare.json (every number in the docs) and, only when a candidate passes every gate,
risk_model_v2.json in the same format the Rails scorer loads.

The labels come from `rake demo:traffic`, where the reviewer's decisions are scripted, so every number
here is synthetic. Production has no human labels yet.
"""
import glob
import json
import math
import os
from datetime import date

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, log_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler

from features import FEATURES
from rules import FLAGGED
from synthetic import generate
from train import pick_threshold

IN_DIR = os.environ.get("IN_DIR", "/kaggle/input")
OUT_DIR = os.environ.get("OUT_DIR", ".")
HOLDOUT_FROM = 7          # row_key hash mod 10 >= 7 is the hold-out (30%), identical for every model
MIN_PER_CLASS = 20        # fewer rows of either class in train or hold-out cannot support a decision; the bootstrap gate covers the rest
DEMO_WEIGHT = 20.0        # one human-labelled row counts as this many synthetic rows in the blended candidate
MIN_GAIN = 0.02           # PR-AUC the candidate must add on the hold-out
MAX_SYNTHETIC_LOSS = 0.01  # PR-AUC the candidate may lose on the original synthetic test set
BOOTSTRAPS = 1000
MODEL_VERSION = "v2"


def find(name):
    hits = glob.glob(os.path.join(IN_DIR, "**", name), recursive=True)
    if not hits:
        raise SystemExit(f"{name} not found under {IN_DIR}")
    return hits[0]


def v1_scores(model, X):
    z = (X - np.array(model["mean"])) / np.array(model["scale"])
    return 1.0 / (1.0 + np.exp(-(z @ np.array(model["coef"]) + model["intercept"])))


def split(rows):
    held = np.array([int(r["row_key"], 16) % 10 >= HOLDOUT_FROM for r in rows])
    X = np.array([r["features"] for r in rows], dtype=float)
    y = np.array([r["label"] for r in rows], dtype=int)
    return X[~held], y[~held], X[held], y[held], np.array([r["ml_score"] for r in rows], dtype=float)[held]


def quality(y, score):
    clipped = np.clip(score, 1e-6, 1 - 1e-6)
    return {
        "roc_auc": round(float(roc_auc_score(y, score)), 4),
        "pr_auc": round(float(average_precision_score(y, score)), 4),
        "log_loss": round(float(log_loss(y, clipped)), 4),
    }


def paired_bootstrap(y, a, b, metric, seed=0):
    """5th percentile of metric(b) - metric(a) over resamples of the same hold-out rows."""
    rng = np.random.default_rng(seed)
    diffs = []
    for _ in range(BOOTSTRAPS):
        idx = rng.integers(0, len(y), len(y))
        if len(set(y[idx])) < 2:
            continue
        diffs.append(metric(y[idx], b[idx]) - metric(y[idx], a[idx]))
    return round(float(np.percentile(diffs, 5)), 4)


def export_model(scaler, lr, threshold, trained_on):
    return {
        "version": MODEL_VERSION,
        "type": "logistic_regression",
        "trained_on": trained_on,
        "features": FEATURES,
        "mean": scaler.mean_.round(6).tolist(),
        "scale": scaler.scale_.round(6).tolist(),
        "coef": lr.coef_[0].round(6).tolist(),
        "intercept": round(float(lr.intercept_[0]), 6),
        "flag_threshold": round(threshold, 6),
    }


def main():
    rows = json.load(open(find("ml_training.json")))
    v1 = json.load(open(find("risk_model_v1.json")))
    X_tr, y_tr, X_ho, y_ho, exported = split(rows)

    result = {
        "generated": str(date.today()),
        "data": "synthetic: scripted reviewer decisions from rake demo:traffic, not real fraud",
        "rows": len(rows),
        "train": {"rows": len(y_tr), "block": int(y_tr.sum())},
        "holdout": {"rows": len(y_ho), "block": int(y_ho.sum())},
    }
    enough = min(int(y_ho.sum()), int((y_ho == 0).sum())) >= MIN_PER_CLASS and min(int(y_tr.sum()), int((y_tr == 0).sum())) >= MIN_PER_CLASS
    if not enough:
        result["decision"] = f"keep {v1['version']}: fewer than {MIN_PER_CLASS} rows of a class in train or hold-out, no comparison is possible"
        return finish(result)

    parity = float(np.abs(v1_scores(v1, X_ho) - exported).max())
    result["v1_parity_max_abs_diff"] = round(parity, 6)

    X_syn_tr, y_syn_tr, _ = generate(100_000, seed=11)
    X_syn_va, _, r_syn_va = generate(40_000, seed=22)
    X_syn_te, y_syn_te, _ = generate(40_000, seed=33)

    s_v1_syn = v1_scores(v1, X_syn_te)
    s_v1 = v1_scores(v1, X_ho)
    result["models"] = {v1["version"]: {"holdout": quality(y_ho, s_v1), "synthetic_test_pr_auc": round(float(average_precision_score(y_syn_te, s_v1_syn)), 4)}}

    candidates = {}
    sc = StandardScaler().fit(X_tr)
    candidates["demo_only"] = (sc, LogisticRegression(C=1.0, max_iter=1000).fit(sc.transform(X_tr), y_tr))
    X_mix = np.vstack([X_syn_tr, X_tr])
    y_mix = np.concatenate([y_syn_tr, y_tr])
    w_mix = np.concatenate([np.ones(len(y_syn_tr)), np.full(len(y_tr), DEMO_WEIGHT)])
    sc2 = StandardScaler().fit(X_mix)
    candidates["synthetic_plus_demo"] = (sc2, LogisticRegression(C=1.0, max_iter=1000).fit(sc2.transform(X_mix), y_mix, sample_weight=w_mix))

    best, best_score = None, None
    for name, (scaler, lr) in candidates.items():
        s_ho = lr.predict_proba(scaler.transform(X_ho))[:, 1]
        s_syn = lr.predict_proba(scaler.transform(X_syn_te))[:, 1]
        syn_pr = float(average_precision_score(y_syn_te, s_syn))
        q = quality(y_ho, s_ho)
        gain = q["pr_auc"] - result["models"][v1["version"]]["holdout"]["pr_auc"]
        lower = paired_bootstrap(y_ho, s_v1, s_ho, roc_auc_score)
        syn_loss = result["models"][v1["version"]]["synthetic_test_pr_auc"] - syn_pr
        gates = {
            "holdout_pr_auc_gain": round(gain, 4),
            "holdout_roc_auc_gain_p5": lower,
            "synthetic_pr_auc_loss": round(syn_loss, 4),
            "passes": bool(gain >= MIN_GAIN and lower > 0 and syn_loss <= MAX_SYNTHETIC_LOSS),
        }
        result["models"][name] = {"holdout": q, "synthetic_test_pr_auc": round(syn_pr, 4), "gates": gates}
        if gates["passes"] and (best is None or gain > best_score):
            best, best_score = name, gain

    if best is None:
        result["decision"] = f"keep {v1['version']}: no candidate cleared every gate (hold-out PR-AUC gain >= {MIN_GAIN}, paired-bootstrap ROC-AUC gain above zero, synthetic PR-AUC loss <= {MAX_SYNTHETIC_LOSS})"
        return finish(result)

    scaler, lr = candidates[best]
    threshold = pick_threshold(lr.predict_proba(scaler.transform(X_syn_va))[:, 1], r_syn_va >= FLAGGED, generate(40_000, seed=22)[1])
    result["decision"] = f"ship {best} as {MODEL_VERSION}"
    result["flag_threshold"] = round(threshold, 6)
    trained_on = "synthetic labelled transactions (ml/synthetic.py)" + (" plus scripted reviewer labels from demo:traffic" if best == "synthetic_plus_demo" else "; scripted reviewer labels from demo:traffic only") + ", not real fraud data"
    finish(result, export_model(scaler, lr, threshold, trained_on))


def finish(result, model=None):
    with open(os.path.join(OUT_DIR, "compare.json"), "w") as f:
        json.dump(result, f, indent=2)
    if model:
        with open(os.path.join(OUT_DIR, f"risk_model_{MODEL_VERSION}.json"), "w") as f:
            json.dump(model, f, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
