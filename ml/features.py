"""Feature contract shared with the Rails scorer (backend/app/services/ml_feature_builder.rb).

The order here is the order in the model file. A golden test on the Rails side scores the vectors
in backend/test/fixtures/files/ml_golden.json, so any drift between the two implementations fails CI.
"""
import math

FEATURES = [
    "log_amount",
    "log_amount_ratio",
    "first_txn",
    "log_txns_1m",
    "log_txns_1h",
    "night",
    "pay_upi",
    "pay_bank_transfer",
    "pay_wallet",
    "new_ip",
    "untrusted_device",
]

NIGHT_HOURS = range(0, 6)
RATIO_CAP = 50.0


def build(amount, avg_amount, total_txns, txns_1m, txns_1h, hour, payment, new_ip, untrusted_device):
    """Raw transaction facts to the feature vector, the same arithmetic as the Ruby builder."""
    ratio = min(amount / avg_amount, RATIO_CAP) if avg_amount > 0 else 0.0
    return [
        math.log1p(amount),
        math.log1p(ratio),
        1.0 if total_txns == 0 else 0.0,
        math.log1p(txns_1m),
        math.log1p(txns_1h),
        1.0 if hour in NIGHT_HOURS else 0.0,
        1.0 if payment == "upi" else 0.0,
        1.0 if payment == "bank_transfer" else 0.0,
        1.0 if payment == "wallet" else 0.0,
        1.0 if new_ip else 0.0,
        1.0 if untrusted_device else 0.0,
    ]
