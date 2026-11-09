import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib";
import type { ApiResponse } from "@/types";
import type { HomePipeline } from "@/features/home";

export interface PublicPipeline {
  window_days: number;
  pipeline: HomePipeline;
}

/** The staff window of pipeline counts (HomeSummary::WINDOW); public, counts only. */
export async function getPublicPipeline(): Promise<PublicPipeline> {
  const response =
    await apiClient.get<ApiResponse<PublicPipeline>>("/public/pipeline");
  return response.data.data;
}

export function usePublicPipeline() {
  return useQuery({
    queryKey: ["public-pipeline"],
    queryFn: getPublicPipeline,
    staleTime: 60_000,
    retry: 2,
  });
}
