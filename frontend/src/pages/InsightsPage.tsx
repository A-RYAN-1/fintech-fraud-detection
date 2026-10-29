import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarList, PageHeader, PageTransition } from "@/components/common";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import { PeriodSelector } from "@/features/dashboard";
import { useInsights, type InsightsPeriod } from "@/features/insights";
import { formatMoney } from "@/utils/money";
import { formatMinutes } from "@/utils/formatMinutes";
import { ruleLabel } from "@/utils/ruleLabels";

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
          {value}
        </p>
        {note && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<InsightsPeriod>("7d");
  const { data, isLoading, isError, refetch } = useInsights(period);

  const header = (
    <PageHeader
      title="Insights"
      description="Every PayPal payment in the period, across all customers, as counts and amounts only. What moved, what was stopped and why, how the model and the AI analyst voted, and how long a held payment waited."
      actions={<PeriodSelector value={period} onChange={setPeriod} />}
    />
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {header}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              The numbers could not be loaded. The API may be waking up, which
              can take a minute.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const t = data.totals;
  const daily = data.daily.map((d) => ({
    date: d.date.slice(5),
    Passed: Math.max(d.payments - d.flagged - d.blocked, 0),
    Held: d.flagged,
    Blocked: d.blocked,
  }));

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        {header}

        {t.payments === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-neutral-600 dark:text-neutral-400">
              No PayPal payment in the last {data.period_days} days. Pick a
              longer period, or sign in as a customer and make a sandbox
              payment.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat
                label="Payments authorized at PayPal"
                value={String(t.payments)}
                note={`${formatMoney(t.volume)} in total`}
              />
              <Stat
                label="Captured"
                value={String(t.captured)}
                note={`${formatMoney(t.captured_amount)}, ${t.auto_captured} by the agent alone`}
              />
              <Stat
                label="Waiting for a person"
                value={String(t.held)}
                note="Held now; see the Review Queue"
              />
              <Stat
                label="Voided"
                value={String(t.voided)}
                note={`${t.blocked_by_rules} blocked by the rules; the rest by a person or before the hold expired`}
              />
              <Stat
                label="Refunded"
                value={formatMoney(t.refunded_amount)}
                note="Settled by a second person"
              />
              <Stat
                label="Time to a decision"
                value={formatMinutes(data.decision_time.median_minutes)}
                note={
                  data.decision_time.decided > 0
                    ? `Median of ${data.decision_time.decided} human decisions; 90% within ${formatMinutes(data.decision_time.p90_minutes)}`
                    : "No human decision in the period"
                }
              />
            </div>

            <Panel
              title="Payments per day"
              description="Held covers the rules and the model; blocked is the rules alone."
            >
              <div
                className="h-72"
                role="img"
                aria-label="Payments per day: passed, held and blocked"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-800"
                    />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      width={32}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Passed" stackId="a" fill="#22c55e" />
                    <Bar dataKey="Held" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Blocked" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel
                title="Rules score"
                description="30 or more holds a payment, 70 or more blocks it (the defaults)."
              >
                <BarList
                  items={data.risk_ranges.map((r) => ({
                    label: r.range,
                    value: r.count,
                  }))}
                  empty="No scores in the period."
                />
              </Panel>
              <Panel
                title="Why payments were stopped"
                description="The rules that fired most often, and the model's own flag."
              >
                <BarList
                  items={data.top_rules.map((r) => ({
                    label: ruleLabel(r.rule),
                    value: r.count,
                  }))}
                  empty="No rule fired in the period."
                />
              </Panel>
              <Panel
                title="Model score"
                description="A second score from a trained model. It can hold a payment the rules passed, never block one."
              >
                <dl className="grid grid-cols-3 gap-4 text-center">
                  {[
                    ["Scored", String(data.model.scored)],
                    ["Above threshold", String(data.model.flagged)],
                    [
                      "Flag rate",
                      data.model.flag_rate === null
                        ? "n/a"
                        : `${(data.model.flag_rate * 100).toFixed(1)}%`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse">
                      <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                        {label}
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel
                title="AI analyst verdicts"
                description="What Gemini recommended on the payments it read. It can escalate to a person, never void or release."
              >
                <BarList
                  items={[
                    { label: "Approve", value: data.ai.approve },
                    { label: "Review by a person", value: data.ai.review },
                    { label: "Block", value: data.ai.block },
                  ]}
                  empty="The AI analyst read no payment in the period."
                />
              </Panel>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              How these signals agreed with the people who decided is on the{" "}
              <Link
                to="/admin/feedback"
                className="font-medium text-primary-700 hover:underline dark:text-primary-300"
              >
                Feedback page
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </PageTransition>
  );
}
