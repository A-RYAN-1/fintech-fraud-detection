import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { createKeyStore } from "@/utils/idempotency";
import { reviewApi, type ReviewAction } from "../api";

export const REVIEW_QUEUE_QUERY_KEY = "admin-review-queue";

export function useReviewQueue(page = 1) {
  return useQuery({
    queryKey: [REVIEW_QUEUE_QUERY_KEY, page],
    queryFn: () => reviewApi.list(page),
    staleTime: 1000 * 15,
  });
}

const DONE: Record<ReviewAction, string> = {
  approve: "Payment captured",
  void: "Payment voided, nothing charged",
  refund: "Payment refunded",
};

// One key per payment and action, kept until it succeeds, so a retried click is answered, not repeated.
const keys = createKeyStore();

export function useReviewAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: ReviewAction;
      note: string;
    }) => reviewApi.act(id, action, note, keys.keyFor(`${id}:${action}`)),
    onSuccess: (_data, { id, action }) => {
      keys.release(`${id}:${action}`);
      queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] });
      toast.success(DONE[action]);
    },
    onError: (error) => {
      toast.error("Action failed", { description: getErrorMessage(error) });
    },
  });
}
