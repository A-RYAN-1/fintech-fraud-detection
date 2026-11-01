import { useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useRevokeMandate } from "@/features/agents";
import { formatMoney } from "@/utils/money";
import { REVIEW_QUEUE_QUERY_KEY } from "../hooks";
import type { AgentContext } from "../api";

// Shown only on a payment an agent made under a mandate: the permission it was made under, what is left of it, and a
// way to stop the agent. Revoking never touches this payment; the reviewer still decides it.
export function AgentContextPanel({ agent }: { agent: AgentContext }) {
  const queryClient = useQueryClient();
  const revoke = useRevokeMandate();

  const onRevoke = () =>
    revoke.mutate(agent.mandate_id, {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: [REVIEW_QUEUE_QUERY_KEY] }),
    });

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Bot className="h-4 w-4" aria-hidden="true" />
          Paid by an agent: {agent.label}
        </div>
        <Badge
          variant={agent.status === "active" ? "success" : "default"}
          className="capitalize"
        >
          Mandate {agent.status}
        </Badge>
      </div>
      <p className="text-neutral-600 dark:text-neutral-400">
        Allowed merchant {agent.merchant}, up to{" "}
        {formatMoney(agent.per_payment_cap)} a payment and{" "}
        {formatMoney(agent.total_cap)} in total;{" "}
        {formatMoney(agent.spent_amount)} used, {formatMoney(agent.remaining)}{" "}
        left. The mandate limits what the agent may ask for; this payment was
        still checked by the rules, the model and the analyst.
      </p>
      {agent.status === "active" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={revoke.isPending}
          onClick={onRevoke}
        >
          Revoke this mandate
        </Button>
      )}
    </div>
  );
}
