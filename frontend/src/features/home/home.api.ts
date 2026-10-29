import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";

export interface HomePipeline {
  authorized: number;
  rules_blocked: number;
  rules_flagged: number;
  model_flagged: number;
  ai_read: number;
  ai_escalated: number;
  human_decided: number;
  captured: number;
  held: number;
  voided: number;
  refunded: number;
}

export type HomeNextStep =
  | {
      kind: "pay" | "wait";
      count: number;
      latest?: { amount: number; paypal_status: string; created_at: string };
    }
  | {
      kind: "review";
      count: number;
      oldest: { amount: number; risk_score: number; created_at: string };
    }
  | { kind: "queue_empty"; count: 0 }
  | {
      kind: "approvals";
      count: number;
      oldest: { action: string; created_at: string };
    };

export interface HomeSummary {
  scope: "own" | "all";
  window_days: number | null;
  pipeline: HomePipeline;
  next_step: HomeNextStep;
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const response = await apiClient.get<ApiResponse<HomeSummary>>("/home");
  return response.data.data;
}

export function useHomeSummary() {
  return useQuery({ queryKey: ["home"], queryFn: getHomeSummary });
}
