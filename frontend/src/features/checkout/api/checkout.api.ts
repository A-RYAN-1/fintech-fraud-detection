import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";
import { idempotencyHeaders } from "@/utils/idempotency";

export type TimelineImpact = "raises_risk" | "lowers_risk" | "neutral";

export interface TimelineEntry {
  signal: string;
  impact: TimelineImpact;
  detail: string;
}

export interface AiVerdict {
  action: "approve" | "review" | "block";
  confidence: number;
  explanation: string;
  model?: string;
  timeline?: TimelineEntry[];
  payload_bytes?: number;
}

export interface CreatedOrder {
  order_id: string;
  transaction_id: string;
}

export interface SettledPayment {
  transaction_id: string;
  decision: "captured" | "held" | "voided";
  status: string;
  risk_score: number;
  paypal_status: string;
  action_reason: string | null;
  rules_triggered: string;
  ml_explanation: unknown[];
  ai_verdict: AiVerdict | null;
  simulated?: boolean;
}

export const checkoutApi = {
  createOrder: async (
    amount: number,
    deviceId: string,
    idempotencyKey: string,
  ): Promise<CreatedOrder> => {
    const response = await apiClient.post<ApiResponse<CreatedOrder>>(
      "/paypal/orders",
      { amount, device_id: deviceId },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },

  // A labelled test payment: same rules, model, AI analyst and admin limits, no PayPal call and no money.
  simulate: async (
    amount: number,
    deviceId: string,
    idempotencyKey: string,
  ): Promise<SettledPayment> => {
    const response = await apiClient.post<ApiResponse<SettledPayment>>(
      "/payments/simulate",
      { amount, device_id: deviceId },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },

  authorizeOrder: async (orderId: string): Promise<SettledPayment> => {
    // Keyed by the order: authorizing the same order twice returns the first result.
    const response = await apiClient.post<ApiResponse<SettledPayment>>(
      `/paypal/orders/${encodeURIComponent(orderId)}/authorize`,
      undefined,
      { headers: idempotencyHeaders(`authorize-${orderId}`) },
    );
    return response.data.data;
  },
};
