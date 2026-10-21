"""Synthetic labelled transactions.

There is no real labelled fraud data behind this project, so the evaluation uses a generator. The
generator is the stated limitation: its fraud patterns are mine, not a bank's. It is built so that
some fraud is invisible to the rules (night-time bursts on a new IP, wallet and UPI takeovers at a
normal amount) and some legitimate traffic trips them (a big planned purchase, a user with a wide
spread of amounts), which is the situation a second score is meant for.
"""
import numpy as np

from features import build
from rules import rule_score

PAYMENTS = ["card", "upi", "bank_transfer", "wallet"]
FRAUD_RATE_TARGET = 0.04


def generate(n, seed):
    rng = np.random.default_rng(seed)
    rows, labels, rule_scores = [], [], []
    while len(rows) < n:
        spread = rng.choice([0.4, 0.8, 1.3], p=[0.5, 0.35, 0.15])
        median = rng.lognormal(7.0, 0.8)
        history = int(rng.choice([0, 1, 3, 10, 40], p=[0.08, 0.1, 0.17, 0.35, 0.3]))
        avg = 0.0 if history == 0 else float(median * np.exp(spread ** 2 / 2))
        payment = rng.choice(PAYMENTS, p=[0.5, 0.3, 0.12, 0.08])
        hour = int(rng.integers(0, 24))
        amount = float(median * rng.lognormal(0.0, spread))
        burst = rng.random() < 0.05
        txns_1m = int(rng.poisson(0.2)) + (int(rng.integers(2, 6)) if burst else 0)
        txns_1h = txns_1m + int(rng.poisson(0.6))
        new_ip = history > 0 and rng.random() < 0.12
        untrusted_device = history > 0 and rng.random() < 0.06

        if rng.random() < 0.10:
            amount *= rng.uniform(3, 12)

        logit = -4.5
        logit += 1.1 * (new_ip and hour < 6)
        logit += 1.4 * (new_ip and payment in ("upi", "wallet"))
        logit += 0.9 * (txns_1h >= 3)
        logit += 0.8 * (txns_1m >= 3 and amount > 3 * median)
        logit += 0.6 * (untrusted_device and new_ip)
        logit += 0.5 * (hour < 6) + 0.4 * (payment == "wallet")
        logit += 0.5 * np.log1p(amount / max(avg, 1.0)) * (history > 0)
        logit += 1.2 * (history == 0 and amount > 20_000)
        logit += rng.normal(0, 0.6)
        fraud = rng.random() < 1.0 / (1.0 + np.exp(-logit))

        rows.append(build(amount, avg, history, txns_1m, txns_1h, hour, payment, new_ip, untrusted_device))
        rule_scores.append(rule_score(amount, avg, history, txns_1m, untrusted_device))
        labels.append(int(fraud))
    return np.array(rows), np.array(labels), np.array(rule_scores)
