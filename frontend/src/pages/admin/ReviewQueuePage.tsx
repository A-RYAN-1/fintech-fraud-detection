import { ClipboardCheck } from "lucide-react";
import { PageTransition, EmptyState } from "@/components/common";
import { Skeleton } from "@/components/ui";
import { useAppSelector } from "@/store";
import { ReviewCard, useReviewAction, useReviewQueue } from "@/features/review";

export default function ReviewQueuePage() {
  const { data, isLoading, isError } = useReviewQueue();
  const act = useReviewAction();
  const user = useAppSelector((state) => state.auth.user);
  const held = data?.held ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Review queue
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Payments the agent held. You can override the agent; every action is
            recorded in the audit log.
          </p>
        </div>

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
                canAct={user?.role === "admin"}
                onAct={(id, action, note) => act.mutate({ id, action, note })}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
