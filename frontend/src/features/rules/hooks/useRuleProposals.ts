import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { createKeyStore } from "@/utils/idempotency";
import { rulesApi, type ProposalStatus } from "../api";

export const RULE_PROPOSALS_QUERY_KEY = "admin-rule-proposals";

export function useRuleProposals(status: ProposalStatus | "all" = "pending") {
  return useQuery({
    queryKey: [RULE_PROPOSALS_QUERY_KEY, status],
    queryFn: () => rulesApi.list(status),
    staleTime: 1000 * 15,
  });
}

const keys = createKeyStore();

export function useSettleProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: number;
      decision: "accept" | "reject";
      note: string;
    }) => rulesApi.settle(id, decision, note, keys.keyFor(`${id}:${decision}`)),
    onSuccess: (_data, { id, decision }) => {
      keys.release(`${id}:${decision}`);
      queryClient.invalidateQueries({ queryKey: [RULE_PROPOSALS_QUERY_KEY] });
      toast.success(
        decision === "accept" ? "Rule changed" : "Proposal rejected",
      );
    },
    onError: (error, { id, decision }) => {
      keys.release(`${id}:${decision}`);
      queryClient.invalidateQueries({ queryKey: [RULE_PROPOSALS_QUERY_KEY] });
      toast.error("Could not settle the proposal", {
        description: getErrorMessage(error),
      });
    },
  });
}
