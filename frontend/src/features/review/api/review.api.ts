import { apiClient } from "@/lib";
import { idempotencyHeaders } from "@/utils/idempotency";
import type { ApiResponse, PaginationMeta } from "@/types";
import type { AiVerdict } from "@/features/checkout";

export interface ReviewNote {
  event_type: "REVIEW_NOTE" | "DECISION_PROPOSED";
  actor: string | null;
  role: string | null;
  text: string | null;
  proposal: ReviewAction | null;
  created_at: string;
}

export interface HeldPayment {
  id: string;
  user_email: string;
  amount: number;
  created_at: string;
  status: string;
  risk_score: number;
  paypal_status: string;
  capture_mode: string | null;
  authorization_expires_at: string | null;
  refunded_amount: number;
  action_reason: string | null;
  rules_triggered: string[];
  ml_score: number | null;
  ml_explanation: unknown[];
  ai_verdict: AiVerdict | null;
  notes: ReviewNote[];
}

export interface ReviewQueueResponse {
  held: HeldPayment[];
  meta: PaginationMeta;
  // The most the signed-in person may decide alone; null means no limit.
  limit: number | null;
  role: string;
}

export type ReviewAction = "approve" | "void" | "refund";

export const reviewApi = {
  list: async (page = 1): Promise<ReviewQueueResponse> => {
    const response = await apiClient.get<ApiResponse<ReviewQueueResponse>>(
      `/admin/review_queue?page=${page}`,
    );
    return response.data.data;
  },

  act: async (
    id: string,
    action: ReviewAction,
    note: string,
    idempotencyKey: string,
  ): Promise<HeldPayment> => {
    const response = await apiClient.post<ApiResponse<HeldPayment>>(
      `/admin/review_queue/${id}/${action}`,
      { note },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },

  note: async (id: string, note: string): Promise<HeldPayment> => {
    const response = await apiClient.post<ApiResponse<HeldPayment>>(
      `/admin/review_queue/${id}/note`,
      { note },
    );
    return response.data.data;
  },

  propose: async (
    id: string,
    proposal: ReviewAction,
    note: string,
  ): Promise<HeldPayment> => {
    const response = await apiClient.post<ApiResponse<HeldPayment>>(
      `/admin/review_queue/${id}/propose`,
      { proposal, note },
    );
    return response.data.data;
  },
};
