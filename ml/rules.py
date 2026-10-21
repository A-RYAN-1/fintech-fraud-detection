"""Python port of backend/app/services/risk_rules_processor.rb, used as the baseline in the evaluation."""

BLOCKED, FLAGGED = 70, 30


def rule_score(amount, avg_amount, total_txns, txns_1m, untrusted_device):
    score = 0
    if total_txns == 0 and amount > 100_000:
        score += 30
    if avg_amount > 0:
        if amount >= avg_amount * 10:
            score += 40
        elif amount >= avg_amount * 5:
            score += 30
        elif amount >= avg_amount * 2:
            score += 20
    if 1_000 <= amount < 10_000 and txns_1m >= 4:
        score += 20
    elif 10_000 <= amount < 50_000 and txns_1m >= 3:
        score += 30
    elif amount >= 50_000 and txns_1m >= 2:
        score += 40
    if untrusted_device:
        score += 30
    return score
