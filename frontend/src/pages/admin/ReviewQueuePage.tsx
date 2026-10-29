import { formatMoney } from "@/utils/money";
import { ClipboardCheck } from "lucide-react";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import { Skeleton } from "@/components/ui";
import { useAppSelector } from "@/store";
import {
  ReviewCard,
  useReviewAction,
  useReviewNote,
  useReviewQueue,
} from "@/features/review";

export default function ReviewQueuePage() {
  const { data, isLoading, isError } = useReviewQueue();
  const act = useReviewAction();
  const noteMutation = useReviewNote();
  const user = useAppSelector((state) => state.auth.user);
  const held = data?.held ?? [];
  const limit = data?.limit ?? null;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Review queue"
          description={`Payments held for a person. Each card shows the rules, the model and the AI analyst side by side; capture or void is a PayPal call and is written to the audit log.${
            user?.role === "reviewer" && limit !== null
              ? ` You can decide payments up to ${formatMoney(limit)}.`
              : ""
          }`}
        />

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            The review queue could not be loaded.
          </p>
        ) : held.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review"
            description="Held payments appear here with the agent's reason."
          />
        ) : (
          <div className="space-y-4">
            {held.map((payment) => (
              <ReviewCard
                key={payment.id}
                payment={payment}
                busy={act.isPending}
                canAct={user?.role === "admin" || user?.role === "reviewer"}
                limit={user?.role === "admin" ? null : limit}
                onAct={(id, action, note) => act.mutate({ id, action, note })}
                onNote={(id, note, proposal) =>
                  noteMutation.mutate({ id, note, proposal })
                }
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
