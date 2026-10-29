import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";
import type { InsightsPeriod } from "@/features/insights";

export interface Spending {
  period_days: number;
  spent: number;
  captured_count: number;
  held: { count: number; amount: number };
  voided: { count: number; amount: number };
  refunded_amount: number;
  daily: { date: string; spent: number; held: number; voided: number }[];
  reasons: { rule: string; count: number }[];
}

export function useSpending(period: InsightsPeriod) {
  return useQuery({
    queryKey: ["spending", period],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Spending>>(
        "/spending",
        { params: { period } },
      );
      return response.data.data;
    },
  });
}
