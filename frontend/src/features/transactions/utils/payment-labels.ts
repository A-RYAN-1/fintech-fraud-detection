import type { Transaction } from "@/types";

// What the agent or a reviewer did with the payment, in words. Older rows that never went through PayPal fall back to
// the rules decision.
export function actionTaken(
  transaction: Pick<Transaction, "paypal_status" | "capture_mode" | "status">,
): string {
  switch (transaction.paypal_status) {
    case "CAPTURED":
      return transaction.capture_mode === "human"
        ? "Captured by reviewer"
        : "Captured by agent";
    case "HELD":
      return "Held for review";
    case "VOIDED":
      return "Voided";
    case "REFUNDED":
      return "Refunded";
    case "PARTIALLY_REFUNDED":
      return "Partly refunded";
    case "AUTHORIZED":
      return "Authorized";
    case "CREATED":
      return "Awaiting approval";
  }
  switch (transaction.status.toLowerCase()) {
    case "success":
      return "Approved";
    case "flagged":
      return "Flagged";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}

export function formatMlScore(score: number | null | undefined): string {
  return score == null ? "-" : `${Math.round(score * 100)}%`;
}
