import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { createKeyStore } from "@/utils/idempotency";
import { reviewApi, type ReviewAction } from "../api";

export const REVIEW_QUEUE_QUERY_KEY = "admin-review-queue";

export function useCapturedPayments(page = 1) {
  return useQuery({
    queryKey: [REVIEW_QUEUE_QUERY_KEY, "captured", page],
    queryFn: () => reviewApi.list(page, "captured"),
    staleTime: 1000 * 15,
  });
}

export function useApprovalRequests(
  status: "pending" | "approved" | "rejected" | "all" = "pending",
) {
  return useQuery({
    queryKey: [REVIEW_QUEUE_QUERY_KEY, "requests", status],
    queryFn: () => reviewApi.listRequests(status),
    staleTime: 1000 * 15,
  });
}

export function useAccountRing(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [REVIEW_QUEUE_QUERY_KEY, "ring", id],
    queryFn: () => reviewApi.ring(id),
    enabled,
    staleTime: 1000 * 60,
  });
}

const settleKeys = createKeyStore();

export function useSettleRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "approve" | "reject";
      note: string;
    }) =>
      reviewApi.settleRequest(
        id,
        decision,
        note,
        settleKeys.keyFor(`${id}:${decision}`),
      ),
    onSuccess: (_data, { id, decision }) => {
      settleKeys.release(`${id}:${decision}`);
      queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] });
      toast.success(
        decision === "approve"
          ? "Approved and carried out"
          : "Request rejected",
      );
    },
    onError: (error) => {
      toast.error("Could not settle the request", {
        description: getErrorMessage(error),
      });
    },
  });
}

export function useRequestRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      amount,
      note,
    }: {
      id: string;
      amount: string;
      note: string;
    }) => reviewApi.requestRefund(id, amount, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] });
      toast.success("Refund sent to an admin for approval");
    },
    onError: (error) => {
      toast.error("Could not request the refund", {
        description: getErrorMessage(error),
      });
    },
  });
}

// Held payments, ten at a time; "Show older" asks for the next cursor.
export function useReviewQueue() {
  return useInfiniteQuery({
    queryKey: [REVIEW_QUEUE_QUERY_KEY, "held"],
    initialPageParam: "",
    queryFn: ({ pageParam }) => reviewApi.listHeld(pageParam),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
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

export function useReviewNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      note,
      proposal,
    }: {
      id: string;
      note: string;
      proposal?: ReviewAction;
    }) =>
      proposal
        ? reviewApi.propose(id, proposal, note)
        : reviewApi.note(id, note),
    onSuccess: (_data, { proposal }) => {
      queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] });
      toast.success(proposal ? `Proposed to ${proposal}` : "Note saved");
    },
    onError: (error) => {
      toast.error("Could not save", { description: getErrorMessage(error) });
    },
  });
}

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
    onSuccess: (data, { id, action }) => {
      keys.release(`${id}:${action}`);
      queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] });
      toast.success(
        data.requested ? "Sent to an admin for a decision" : DONE[action],
      );
    },
    onError: (error) => {
      toast.error("Action failed", { description: getErrorMessage(error) });
    },
  });
}
