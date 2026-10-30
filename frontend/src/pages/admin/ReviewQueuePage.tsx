import { formatMoney } from "@/utils/money";
import { ClipboardCheck } from "lucide-react";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import { Button, Skeleton } from "@/components/ui";
import { useAppSelector } from "@/store";
import {
  ReviewCard,
  useReviewAction,
  useReviewNote,
  useReviewQueue,
} from "@/features/review";

export default function ReviewQueuePage() {
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useReviewQueue();
  const act = useReviewAction();
  const noteMutation = useReviewNote();
  const user = useAppSelector((state) => state.auth.user);
  const held = data?.pages.flatMap((page) => page.held) ?? [];
  const totalHeld = data?.pages[0]?.meta.total_count ?? 0;
  const limit = data?.pages[0]?.limit ?? null;

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
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Showing {held.length} of {totalHeld} held
              </p>
              {hasNextPage && (
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Show older"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
