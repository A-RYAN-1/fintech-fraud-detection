import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { agentsApi, type NewMandate } from "../api";

export const AGENT_MANDATES_QUERY_KEY = "agent-mandates";

export function useAgentMandates() {
  return useQuery({
    queryKey: [AGENT_MANDATES_QUERY_KEY],
    queryFn: agentsApi.list,
    staleTime: 1000 * 15,
  });
}

export function useCreateMandate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewMandate) => agentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AGENT_MANDATES_QUERY_KEY] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRevokeMandate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => agentsApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AGENT_MANDATES_QUERY_KEY] });
      toast.success("Mandate revoked. The agent is stopped.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
