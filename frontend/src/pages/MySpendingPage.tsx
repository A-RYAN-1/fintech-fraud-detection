import { useState } from "react";
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
import type { InsightsPeriod } from "@/features/insights";
import { useSpending } from "@/features/spending";
import { formatMoney } from "@/utils/money";
import { ruleLabel } from "@/utils/ruleLabels";

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
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
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {note}
        </p>
      </CardContent>
    </Card>
  );
}

export default function MySpendingPage() {
  const [period, setPeriod] = useState<InsightsPeriod>("30d");
  const { data, isLoading, isError, refetch } = useSpending(period);

  const header = (
    <PageHeader
      title="My Spending"
      description="Your own PayPal payments: what was charged, what waits for a reviewer, what was stopped and why."
      actions={<PeriodSelector value={period} onChange={setPeriod} />}
    />
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
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
              Your spending could not be loaded. The API may be waking up,
              which can take a minute.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nothing =
    data.captured_count === 0 && data.held.count === 0 && data.voided.count === 0;
  const daily = data.daily.map((d) => ({
    date: d.date.slice(5),
    Charged: d.spent,
    Held: d.held,
    Voided: d.voided,
  }));

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        {header}

        {nothing ? (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No PayPal payment in the last {data.period_days} days.
              </p>
              <Button asChild>
                <Link to="/pay">Make a sandbox payment</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Spent"
                value={formatMoney(data.spent)}
                note={`${data.captured_count} captured payment${data.captured_count === 1 ? "" : "s"}${data.refunded_amount > 0 ? `, after ${formatMoney(data.refunded_amount)} refunded` : ""}`}
              />
              <Stat
                label="Held for a reviewer"
                value={formatMoney(data.held.amount)}
                note={`${data.held.count} payment${data.held.count === 1 ? "" : "s"}; authorized at PayPal, not charged yet`}
              />
              <Stat
                label="Voided"
                value={formatMoney(data.voided.amount)}
                note={`${data.voided.count} payment${data.voided.count === 1 ? "" : "s"}; nothing was charged`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Money per day</CardTitle>
                <CardDescription>
                  Charged is captured money less refunds.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="h-72"
                  role="img"
                  aria-label="Money per day: charged, held and voided"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-neutral-200 dark:stroke-neutral-800"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={48} />
                      <Tooltip formatter={(v) => formatMoney(Number(v))} />
                      <Legend />
                      <Bar dataKey="Charged" stackId="a" fill="#22c55e" />
                      <Bar dataKey="Held" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Voided" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Why payments were held or voided
                </CardTitle>
                <CardDescription>
                  The checks that fired on your held and voided payments. Each
                  payment's full result is in{" "}
                  <Link
                    to="/history"
                    className="font-medium text-primary-700 hover:underline dark:text-primary-300"
                  >
                    History
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  items={data.reasons.map((r) => ({
                    label: ruleLabel(r.rule),
                    value: r.count,
                  }))}
                  empty="None of your payments were held or voided by a check."
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageTransition>
  );
}
