import { apiClient } from "@/lib";
import { idempotencyHeaders } from "@/utils/idempotency";
import type { ApiResponse, KeysetMeta, PaginationMeta } from "@/types";
import type { AiVerdict } from "@/features/checkout";

export type ReviewAction = "approve" | "void" | "refund";

export interface ApprovalRequest {
  id: number;
  transaction_id: string;
  action: ReviewAction;
  amount: number | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  payment: {
    amount: number;
    user_email: string;
    paypal_status: string;
    simulated: boolean;
  };
}

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
  pending_request: ApprovalRequest | null;
}

export interface ReviewQueueResponse {
  held: HeldPayment[];
  meta: PaginationMeta | KeysetMeta;
  // The most the signed-in person may decide alone; null means no limit.
  limit: number | null;
  role: string;
}

// An approve or void either happens (payment) or, above the caller's limit, becomes a request for an admin.
export type ActResult =
  | { payment: HeldPayment; requested?: undefined }
  | { requested: ApprovalRequest; payment?: undefined };

export interface ReviewQueuePage extends ReviewQueueResponse {
  meta: KeysetMeta;
}

export interface RingMember {
  user_id: number;
  email: string;
  hops: number;
  payments: number;
  voided: number;
  captured: number;
}

// Accounts linked to a payment's customer through shared devices (last window_days days, up to three hops).
export interface AccountRing {
  size: number;
  depth: number;
  devices_shared: number;
  window_days: number;
  members: RingMember[];
}

export type AnalystQuestion = "why" | "change";

export interface AnalystAnswer {
  question: AnalystQuestion;
  answer: string;
  source: "ai" | "rules";
  model: string | null;
}

export const reviewApi = {
  ask: async (
    id: string,
    question: AnalystQuestion,
  ): Promise<AnalystAnswer> => {
    const response = await apiClient.post<ApiResponse<AnalystAnswer>>(
      `/admin/review_queue/${id}/ask`,
      { question },
    );
    return response.data.data;
  },

  ring: async (id: string): Promise<AccountRing> => {
    const response = await apiClient.get<ApiResponse<AccountRing>>(
      `/admin/review_queue/${id}/ring`,
    );
    return response.data.data;
  },

  // Held payments newest first by keyset: "" is the first page, then the meta's next_cursor.
  listHeld: async (cursor = ""): Promise<ReviewQueuePage> => {
    const response = await apiClient.get<ApiResponse<ReviewQueuePage>>(
      `/admin/review_queue?cursor=${encodeURIComponent(cursor)}`,
    );
    return response.data.data;
  },

  list: async (
    page = 1,
    scope: "held" | "captured" = "held",
  ): Promise<ReviewQueueResponse> => {
    const response = await apiClient.get<ApiResponse<ReviewQueueResponse>>(
      `/admin/review_queue?page=${page}&scope=${scope}`,
    );
    return response.data.data;
  },

  listRequests: async (
    status: "pending" | "approved" | "rejected" | "all" = "pending",
    page = 1,
  ): Promise<{
    approval_requests: ApprovalRequest[];
    meta: PaginationMeta;
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        approval_requests: ApprovalRequest[];
        meta: PaginationMeta;
      }>
    >(`/admin/approval_requests?status=${status}&page=${page}`);
    return response.data.data;
  },

  settleRequest: async (
    id: number,
    decision: "approve" | "reject",
    note: string,
    idempotencyKey: string,
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post<ApiResponse<ApprovalRequest>>(
      `/admin/approval_requests/${id}/${decision}`,
      { note },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },

  requestRefund: async (
    id: string,
    amount: string,
    note: string,
  ): Promise<ApprovalRequest> => {
    const response = await apiClient.post<
      ApiResponse<{ approval_request: ApprovalRequest }>
    >(`/admin/review_queue/${id}/refund`, {
      amount: amount || undefined,
      note,
    });
    return response.data.data.approval_request;
  },

  act: async (
    id: string,
    action: ReviewAction,
    note: string,
    idempotencyKey: string,
  ): Promise<ActResult> => {
    const response = await apiClient.post<
      ApiResponse<HeldPayment | { approval_request: ApprovalRequest }>
    >(
      `/admin/review_queue/${id}/${action}`,
      { note },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    const data = response.data.data;
    return "approval_request" in data
      ? { requested: data.approval_request }
      : { payment: data };
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
