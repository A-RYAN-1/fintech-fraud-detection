import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";

export type MandateStatus = "active" | "expired" | "revoked" | "exhausted";

export interface AgentMandate {
  id: number;
  label: string;
  merchant: string;
  per_payment_cap: string;
  total_cap: string;
  spent_amount: string;
  remaining: string;
  status: MandateStatus;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  token_hint: string;
  owner_email: string | null;
}

export interface NewMandate {
  label: string;
  merchant: string;
  per_payment_cap: string;
  total_cap: string;
  expires_in_days: number;
}

export interface MandateList {
  mandates: AgentMandate[];
  scope: "mine" | "all";
}

export const agentsApi = {
  list: async (): Promise<MandateList> => {
    const response =
      await apiClient.get<ApiResponse<MandateList>>("/agent_mandates");
    return response.data.data;
  },

  // The token comes back once, in this response only.
  create: async (
    input: NewMandate,
  ): Promise<AgentMandate & { token: string }> => {
    const response = await apiClient.post<
      ApiResponse<AgentMandate & { token: string }>
    >("/agent_mandates", input);
    return response.data.data;
  },

  revoke: async (id: number): Promise<AgentMandate> => {
    const response = await apiClient.post<ApiResponse<AgentMandate>>(
      `/agent_mandates/${id}/revoke`,
    );
    return response.data.data;
  },
};
