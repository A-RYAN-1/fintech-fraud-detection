import { CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui";
import { CaseTimeline } from "@/features/review";
import type { SettledPayment } from "../api";

const OUTCOME = {
  captured: {
    icon: CheckCircle2,
    title: "Payment captured",
    tone: "text-emerald-700 dark:text-emerald-400",
    text: "The agent approved this payment inside its limits and took the funds.",
  },
  held: {
    icon: PauseCircle,
    title: "Payment held for review",
    tone: "text-amber-700 dark:text-amber-400",
    text: "Funds are authorized but not taken. A reviewer decides.",
  },
  voided: {
    icon: XCircle,
    title: "Payment blocked",
    tone: "text-red-700 dark:text-red-400",
    text: "The authorization was released. Nothing was charged.",
  },
} as const;

export function PaymentOutcome({ payment }: { payment: SettledPayment }) {
  const outcome = OUTCOME[payment.decision];
  const Icon = outcome.icon;
  const rules = payment.rules_triggered
    ? payment.rules_triggered.split(",").filter(Boolean)
    : [];

  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className={`flex items-center gap-2 font-semibold ${outcome.tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {outcome.title}
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {outcome.text}
      </p>
      {payment.simulated && (
        <Badge variant="info">Simulated payment, no money moved</Badge>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-neutral-500">Risk score</dt>
          <dd className="font-medium">{payment.risk_score}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">PayPal status</dt>
          <dd className="font-medium">{payment.paypal_status}</dd>
        </div>
      </dl>

      {payment.action_reason && (
        <p className="text-sm">
          <span className="text-neutral-500">Why: </span>
          {payment.action_reason}
        </p>
      )}

      {rules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rules.map((rule) => (
            <Badge key={rule} variant="outline">
              {rule}
            </Badge>
          ))}
        </div>
      )}

      {payment.ai_verdict && (
        <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <div className="mb-1 flex items-center gap-2 font-medium">
            AI analyst: {payment.ai_verdict.action}
            <span className="text-neutral-500">
              {Math.round(payment.ai_verdict.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            {payment.ai_verdict.explanation}
          </p>
          <div className="mt-3">
            <CaseTimeline entries={payment.ai_verdict.timeline} />
          </div>
        </div>
      )}
    </div>
  );
}
