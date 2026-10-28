import { apiClient } from "@/lib";
import type { ApiResponse, PaginationMeta } from "@/types";

export type FeedbackSignal = "rules" | "ml" | "ai";

export interface SignalStats {
  answered: number;
  agree: number;
  agreement_rate: number | null;
  false_alarms: number;
  misses: number;
}

export interface DailyAgreement {
  date: string;
  labelled: number;
  rules: number | null;
  ml: number | null;
  ai: number | null;
}

export interface Disagreement {
  transaction_id: string;
  amount: number;
  human_label: "approve" | "block";
  label_source: "decision" | "refund";
  labeled_by: string | null;
  labeled_at: string;
  rules_status: string;
  rules_triggered: string[];
  ml_score: number | null;
  ai_action: string | null;
  ai_confidence: number | null;
  ai_explanation: string | null;
  disagreeing: FeedbackSignal[];
}

export interface FeedbackResponse {
  labelled: number;
  human_approve: number;
  human_block: number;
  signals: Record<FeedbackSignal, SignalStats>;
  daily: DailyAgreement[];
  disagreements: Disagreement[];
  meta: PaginationMeta;
}

export const feedbackApi = {
  get: async (
    signal: FeedbackSignal | null,
    page = 1,
  ): Promise<FeedbackResponse> => {
    const query = new URLSearchParams({ page: String(page) });
    if (signal) query.set("signal", signal);
    const response = await apiClient.get<ApiResponse<FeedbackResponse>>(
      `/admin/feedback?${query.toString()}`,
    );
    return response.data.data;
  },
};
