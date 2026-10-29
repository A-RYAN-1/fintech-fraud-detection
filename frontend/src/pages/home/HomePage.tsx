import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHeader, PageTransition } from "@/components/common";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import { pipelineSteps, roleGuides, type PipelineStep } from "@/config";
import { useAuth } from "@/features/auth/hooks";
import {
  useHomeSummary,
  type HomeNextStep,
  type HomePipeline,
} from "@/features/home";
import type { UserRole } from "@/types";
import { formatDateTime } from "@/utils";
import { formatMoney } from "@/utils/money";

/** The counts shown under each pipeline step. */
function countsFor(
  key: PipelineStep["key"],
  p: HomePipeline,
): [string, number][] {
  switch (key) {
    case "paypal":
      return [["authorized", p.authorized]];
    case "rules":
      return [
        ["blocked", p.rules_blocked],
        ["held", p.rules_flagged],
      ];
    case "model":
      return [["held", p.model_flagged]];
    case "ai":
      return [
        ["read", p.ai_read],
        ["escalated", p.ai_escalated],
      ];
    case "human":
      return [
        ["decided", p.human_decided],
        ["waiting", p.held],
      ];
    case "result":
      return [
        ["captured", p.captured],
        ["voided", p.voided],
        ["refunded", p.refunded],
      ];
  }
}

interface StartHere {
  title: string;
  body: string;
  action: string;
  href: string;
}

function startHere(step: HomeNextStep, role: UserRole): StartHere {
  switch (step.kind) {
    case "pay":
      return {
        title: "Make a sandbox payment",
        body:
          step.count === 0
            ? "Pay with PayPal's buttons or simulate a payment, then watch Sentrix decide it."
            : `You have ${step.count} payment${step.count === 1 ? "" : "s"}. Make another and compare the checks.`,
        action: "Go to Pay",
        href: "/pay",
      };
    case "wait":
      return {
        title: "A payment is waiting for a reviewer",
        body: step.latest
          ? `Your payment of ${formatMoney(step.latest.amount)} is held. PayPal has authorized it; nothing is charged until a reviewer captures it.`
          : "A payment of yours is held for a reviewer.",
        action: "Open History",
        href: "/history",
      };
    case "review":
      return {
        title:
          role === "analyst"
            ? "Read the evidence on the oldest held payment"
            : "Decide the oldest held payment",
        body: `${step.count} payment${step.count === 1 ? "" : "s"} wait for a person. The oldest: ${formatMoney(step.oldest.amount)}, risk score ${step.oldest.risk_score}, since ${formatDateTime(step.oldest.created_at)}.`,
        action: "Open the Review Queue",
        href: "/admin/review",
      };
    case "queue_empty":
      return {
        title: "Nothing is waiting for a person",
        body: "Every held payment has been decided. See how the rules, the model and the AI analyst agreed with those decisions.",
        action: "Open Feedback",
        href: "/admin/feedback",
      };
    case "approvals":
      return {
        title: "Settle the waiting requests",
        body: `${step.count} request${step.count === 1 ? "" : "s"} wait for an admin. The oldest asks to ${step.oldest.action}, since ${formatDateTime(step.oldest.created_at)}. Approving runs the PayPal call.`,
        action: "Open Approvals",
        href: "/admin/approvals",
      };
  }
}

function Pipeline({
  pipeline,
  scope,
}: {
  pipeline: HomePipeline;
  scope: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How a payment is decided</CardTitle>
        <CardDescription>{scope}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelineSteps.map((step, i) => (
            <li
              key={step.key}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Step {i + 1}
              </p>
              <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                {step.title}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {step.line}
              </p>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {countsFor(step.key, pipeline).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-row-reverse items-baseline justify-end gap-1"
                  >
                    <dt className="text-sm text-neutral-500 dark:text-neutral-400">
                      {label}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useHomeSummary();
  if (!user) return null;

  const guide = roleGuides[user.role];
  const start = data ? startHere(data.next_step, user.role) : null;
  const scope =
    data?.scope === "own"
      ? "Counts over your own payments."
      : `Counts over every payment of the last ${data?.window_days ?? 7} days.`;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title={`Welcome, ${user.first_name}`}
          description={guide.summary}
        />

        <section aria-labelledby="start-here">
          <h2 id="start-here" className="sr-only">
            Start here
          </h2>
          {isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : isError || !start ? (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  The live numbers could not be loaded. The API may be waking
                  up, which can take a minute.
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary-200 dark:border-primary-900">
              <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                    Start here
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {start.title}
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                    {start.body}
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link to={start.href}>
                    {start.action}
                    <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        <section aria-labelledby="role-tasks" className="space-y-3">
          <h2
            id="role-tasks"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
          >
            What you can do as {guide.label.toLowerCase()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guide.tasks.map((task) => (
              <Link
                key={task.href}
                to={task.href}
                className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
              >
                <Card className="h-full transition-colors group-hover:border-primary-300 dark:group-hover:border-primary-700">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {task.title}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{task.body}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {data ? (
          <Pipeline pipeline={data.pipeline} scope={scope} />
        ) : (
          isLoading && <Skeleton className="h-64 w-full" />
        )}
      </div>
    </PageTransition>
  );
}
