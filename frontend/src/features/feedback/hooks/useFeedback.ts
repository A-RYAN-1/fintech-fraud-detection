import { useQuery } from "@tanstack/react-query";
import { feedbackApi, type FeedbackSignal } from "../api";

export const FEEDBACK_QUERY_KEY = "admin-feedback";

export function useFeedback(signal: FeedbackSignal | null, page = 1) {
  return useQuery({
    queryKey: [FEEDBACK_QUERY_KEY, signal, page],
    queryFn: () => feedbackApi.get(signal, page),
    staleTime: 1000 * 30,
  });
}
