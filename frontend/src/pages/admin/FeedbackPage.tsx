import { formatMoney } from "@/utils/money";
import { useState } from "react";
import { MessageSquareWarning } from "lucide-react";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import {
  useFeedback,
  formatRate,
  SIGNAL_HELP,
  SIGNAL_LABEL,
  type Disagreement,
  type FeedbackSignal,
} from "@/features/feedback";

const SIGNALS: FeedbackSignal[] = ["rules", "ml", "ai"];

function DisagreementRow({ row }: { row: Disagreement }) {
  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{formatMoney(row.amount)}</div>
          <div className="text-sm text-neutral-500">
            Human decision: {row.human_label}
            {row.label_source === "refund"
              ? " (after a full refund)"
              : ""} by {row.labeled_by ?? "unknown"} on{" "}
            {new Date(row.labeled_at).toLocaleString()}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.disagreeing.map((signal) => (
            <Badge key={signal} variant="warning">
              {SIGNAL_LABEL[signal]} disagreed
            </Badge>
          ))}
        </div>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-500">Rules and model</dt>
          <dd className="capitalize">{row.rules_status.toLowerCase()}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Model score</dt>
          <dd>{row.ml_score === null ? "n/a" : row.ml_score.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">AI analyst</dt>
          <dd className="capitalize">
            {row.ai_action ?? "no verdict"}
            {row.ai_confidence !== null &&
              ` (${Math.round(row.ai_confidence * 100)}%)`}
          </dd>
        </div>
      </dl>
      {row.ai_explanation && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {row.ai_explanation}
        </p>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const [signal, setSignal] = useState<FeedbackSignal | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFeedback(signal, page);

  const pickSignal = (next: FeedbackSignal | null) => {
    setSignal(next);
    setPage(1);
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Feedback loop"
          description="A reviewer's decision on a held payment is the label. Each automatic signal votes safe or risky and is scored against it. In the demo the decisions come from a scripted traffic generator, so these figures are on synthetic data."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {SIGNALS.map((key) => {
            const stats = data?.signals[key];
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {SIGNAL_LABEL[key]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {isLoading || !stats ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        {formatRate(stats.agreement_rate)}
                      </div>
                      <div className="text-sm text-neutral-500">
                        agrees with the human ({stats.agree} of {stats.answered}
                        )
                      </div>
                      <div className="text-sm text-neutral-500">
                        {stats.false_alarms} false alarms, {stats.misses} misses
                      </div>
                      <p className="pt-1 text-xs text-neutral-500">
                        {SIGNAL_HELP[key]}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agreement by day</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !data || data.daily.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No decisions yet. Approve or void a held payment and it shows
                here.
              </p>
            ) : (
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Agreement by signal"
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Share of each day&apos;s human decisions each signal agreed
                    with
                  </caption>
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="py-1 pr-4 font-medium">Day</th>
                      <th className="py-1 pr-4 font-medium">Decisions</th>
                      {SIGNALS.map((key) => (
                        <th key={key} className="py-1 pr-4 font-medium">
                          {SIGNAL_LABEL[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((day) => (
                      <tr
                        key={day.date}
                        className="border-t border-neutral-200 dark:border-neutral-800"
                      >
                        <td className="py-1 pr-4">{day.date}</td>
                        <td className="py-1 pr-4">{day.labelled}</td>
                        {SIGNALS.map((key) => (
                          <td key={key} className="py-1 pr-4">
                            {formatRate(day[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where a signal disagreed with the human</CardTitle>
            <div
              className="flex flex-wrap gap-2 pt-2"
              role="group"
              aria-label="Filter by signal"
            >
              <Button
                size="sm"
                variant={signal === null ? "default" : "outline"}
                aria-pressed={signal === null}
                onClick={() => pickSignal(null)}
              >
                All
              </Button>
              {SIGNALS.map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={signal === key ? "default" : "outline"}
                  aria-pressed={signal === key}
                  onClick={() => pickSignal(key)}
                >
                  {SIGNAL_LABEL[key]}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !data || data.disagreements.length === 0 ? (
              <EmptyState
                icon={MessageSquareWarning}
                title="No disagreements"
                description="Every signal in this view agreed with the human decision."
              />
            ) : (
              data.disagreements.map((row) => (
                <DisagreementRow key={row.transaction_id} row={row} />
              ))
            )}
            {data && data.meta.total_pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-neutral-500">
                  Page {data.meta.current_page} of {data.meta.total_pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= data.meta.total_pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
