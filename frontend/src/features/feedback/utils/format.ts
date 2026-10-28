import type { FeedbackSignal } from "../api";

export const SIGNAL_LABEL: Record<FeedbackSignal, string> = {
  rules: "Rules and model",
  ml: "Model alone",
  ai: "AI analyst",
};

export const SIGNAL_HELP: Record<FeedbackSignal, string> = {
  rules: "The payment status the rules and the model produced together.",
  ml: "The risk model on its own, at its flag threshold.",
  ai: "The analyst verdict: approve is safe, review or block is risky.",
};

// 0.833 -> "83%"; no answers yet -> "n/a"
export function formatRate(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}
