import { apiClient } from "@/lib";
import { idempotencyHeaders } from "@/utils/idempotency";
import type { ApiResponse, PaginationMeta } from "@/types";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "superseded";

export interface BacktestMetrics {
  success: number;
  flagged: number;
  blocked: number;
  false_alarms: number;
  misses: number;
}

export interface BacktestFlip {
  transaction_id: string;
  amount: number;
  from: string;
  to: string;
  human_label: "approve" | "block" | null;
}

export interface Backtest {
  replayed: number;
  labelled: number;
  fidelity: { matches: number; total: number; rate: number | null };
  baseline: BacktestMetrics;
  candidate: BacktestMetrics;
  delta: BacktestMetrics;
  flips: BacktestFlip[];
  focus: { transaction_id: string; from: string; to: string } | null;
  notes: string;
}

export interface RuleProposal {
  id: number;
  key: string;
  description: string;
  current_value: number;
  proposed_value: number;
  live_value: number;
  trigger_kind: "false_alarm" | "miss";
  transaction_id: string | null;
  rationale: string;
  backtest: Backtest;
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface RuleProposalsResponse {
  rule_proposals: RuleProposal[];
  meta: PaginationMeta;
}

export const rulesApi = {
  list: async (
    status: ProposalStatus | "all",
  ): Promise<RuleProposalsResponse> => {
    const response = await apiClient.get<ApiResponse<RuleProposalsResponse>>(
      `/admin/rule_proposals?status=${status}&per_page=50`,
    );
    return response.data.data;
  },

  settle: async (
    id: number,
    decision: "accept" | "reject",
    note: string,
    idempotencyKey: string,
  ): Promise<RuleProposal> => {
    const response = await apiClient.post<ApiResponse<RuleProposal>>(
      `/admin/rule_proposals/${id}/${decision}`,
      { note },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },
};
