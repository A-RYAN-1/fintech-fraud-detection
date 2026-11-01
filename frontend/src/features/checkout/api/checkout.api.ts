import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";
import { idempotencyHeaders } from "@/utils/idempotency";

export type TimelineImpact = "raises_risk" | "lowers_risk" | "neutral";

export interface TimelineEntry {
  signal: string;
  impact: TimelineImpact;
  detail: string;
}

// Result of the check that the analyst's wording cites nothing outside the case facts (see docs/analyst-grounding.md).
export interface VerdictGrounding {
  status: "passed" | "rejected" | "not_applicable";
  issues: {
    kind: "unknown_number" | "unknown_rule" | "identifier";
    detail: string | null;
  }[];
}

export interface AiVerdict {
  action: "approve" | "review" | "block";
  confidence: number;
  explanation: string;
  model?: string;
  timeline?: TimelineEntry[];
  payload_bytes?: number;
  grounding?: VerdictGrounding;
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

export interface PaymentLimits {
  max_auto_capture_amount: number;
  daily_auto_capture_cap: number;
}

export const checkoutApi = {
  limits: async (): Promise<PaymentLimits> => {
    const response =
      await apiClient.get<ApiResponse<PaymentLimits>>("/payment_limits");
    return response.data.data;
  },

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
