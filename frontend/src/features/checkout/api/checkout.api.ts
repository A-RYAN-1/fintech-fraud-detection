import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";

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
}

export const checkoutApi = {
  createOrder: async (
    amount: number,
    deviceId: string,
  ): Promise<CreatedOrder> => {
    const response = await apiClient.post<ApiResponse<CreatedOrder>>(
      "/paypal/orders",
      { amount, device_id: deviceId },
    );
    return response.data.data;
  },

  authorizeOrder: async (orderId: string): Promise<SettledPayment> => {
    const response = await apiClient.post<ApiResponse<SettledPayment>>(
      `/paypal/orders/${encodeURIComponent(orderId)}/authorize`,
    );
    return response.data.data;
  },
};
