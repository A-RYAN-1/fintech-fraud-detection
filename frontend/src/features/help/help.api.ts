import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";

export interface HealthStatus {
  status: string;
  database: string;
  timestamp: string;
}

export interface AnalystStatus {
  enabled: boolean;
  model: string;
  state: "closed" | "open" | "half_open";
  retry_in_seconds: number;
}

export type SupportTopic = "payment" | "review" | "account" | "other";

export const helpApi = {
  /** Public: is the API up and can it reach its database. */
  health: async (): Promise<HealthStatus> => {
    const response = await apiClient.get<HealthStatus>("/health");
    return response.data;
  },

  /** Staff only: whether the AI analyst is configured and its circuit breaker state. */
  analystStatus: async (): Promise<AnalystStatus> => {
    const response = await apiClient.get<ApiResponse<AnalystStatus>>(
      "/admin/analyst_status",
    );
    return response.data.data;
  },

  /** Sends a message that every active admin receives as a notification. */
  sendSupportMessage: async (body: {
    topic: SupportTopic;
    subject: string;
    message: string;
  }): Promise<{ delivered_to: number }> => {
    const response = await apiClient.post<
      ApiResponse<{ delivered_to: number }>
    >("/support_messages", body);
    return response.data.data;
  },
};
