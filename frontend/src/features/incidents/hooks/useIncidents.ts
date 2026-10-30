import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { createKeyStore } from "@/utils/idempotency";
import { incidentsApi } from "../api";

export const INCIDENTS_QUERY_KEY = "admin-incidents";

export function useIncidents() {
  return useQuery({
    queryKey: [INCIDENTS_QUERY_KEY, "all"],
    queryFn: () => incidentsApi.list("all"),
    staleTime: 1000 * 15,
  });
}

export function useScanIncidents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => incidentsApi.scan(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_QUERY_KEY] });
      toast.success("Scan finished");
    },
    onError: (error) => {
      toast.error("Could not scan", { description: getErrorMessage(error) });
    },
  });
}

const keys = createKeyStore();

export function useDecideIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
      issueUrl,
    }: {
      id: number;
      decision: "approve" | "dismiss";
      note: string;
      issueUrl: string;
    }) =>
      incidentsApi.decide(
        id,
        decision,
        note,
        issueUrl,
        keys.keyFor(`${id}:${decision}`),
      ),
    onSuccess: (_data, { id, decision }) => {
      keys.release(`${id}:${decision}`);
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_QUERY_KEY] });
      toast.success(
        decision === "approve"
          ? "Report approved. File it from the link; nothing was filed for you."
          : "Incident dismissed",
      );
    },
    onError: (error, { id, decision }) => {
      keys.release(`${id}:${decision}`);
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_QUERY_KEY] });
      toast.error("Could not save the decision", {
        description: getErrorMessage(error),
      });
    },
  });
}

export function useSuggestCause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      incidentsApi.suggest(id, keys.keyFor(`${id}:suggest`)),
    onSuccess: (_data, id) => {
      keys.release(`${id}:suggest`);
      queryClient.invalidateQueries({ queryKey: [INCIDENTS_QUERY_KEY] });
    },
    onError: (error, id) => {
      keys.release(`${id}:suggest`);
      toast.error("No suggestion", { description: getErrorMessage(error) });
    },
  });
}
