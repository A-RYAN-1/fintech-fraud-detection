import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";

export type InsightsPeriod = "7d" | "30d" | "90d";

export interface Insights {
  period_days: number;
  totals: {
    payments: number;
    volume: number;
    captured_amount: number;
    refunded_amount: number;
    captured: number;
    held: number;
    voided: number;
    blocked_by_rules: number;
    auto_captured: number;
  };
  daily: {
    date: string;
    payments: number;
    volume: number;
    flagged: number;
    blocked: number;
  }[];
  risk_ranges: { range: string; min: number; max: number; count: number }[];
  top_rules: { rule: string; count: number }[];
  model: { scored: number; flagged: number; flag_rate: number | null };
  ai: { read: number; approve: number; review: number; block: number };
  decision_time: {
    decided: number;
    median_minutes: number | null;
    p90_minutes: number | null;
  };
}

export function useInsights(period: InsightsPeriod) {
  return useQuery({
    queryKey: ["insights", period],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Insights>>(
        "/admin/insights",
        { params: { period } },
      );
      return response.data.data;
    },
  });
}
