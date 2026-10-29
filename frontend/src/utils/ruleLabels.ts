/** Plain names for the rule keys stored on an evaluation (risk_rules_processor.rb, transaction_risk_evaluator.rb). */
const RULE_LABELS: Record<string, string> = {
  AMOUNT_DEVIATION_HIGH: "Amount far above the usual spend",
  AMOUNT_DEVIATION_MEDIUM: "Amount well above the usual spend",
  AMOUNT_DEVIATION_LOW: "Amount above the usual spend",
  FIRST_TRANSACTION_HIGH_AMOUNT: "Large first payment",
  MISSING_DEVICE_ID: "No device id",
  UNTRUSTED_DEVICE: "New or untrusted device",
  RAPID_MEDIUM_AMOUNT: "Rapid medium payments",
  RAPID_LARGE_AMOUNT: "Rapid large payments",
  RAPID_VERY_LARGE_AMOUNT: "Rapid very large payments",
  ML_RISK_SCORE: "Model score above its threshold",
};

export function ruleLabel(rule: string): string {
  return (
    RULE_LABELS[rule] ??
    rule.charAt(0) + rule.slice(1).toLowerCase().replace(/_/g, " ")
  );
}
