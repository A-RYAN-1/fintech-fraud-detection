import { formatMoney } from "@/utils/money";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Clock,
  Cpu,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Button, Card, Label, Textarea } from "@/components/ui";
import { cn } from "@/utils";
import type { HeldPayment, ReviewAction } from "../api";
import { CaseTimeline } from "./CaseTimeline";
import { AgentContextPanel } from "./AgentContextPanel";
import { GroundingNote } from "./GroundingNote";
import { InvestigatePanel } from "./InvestigatePanel";
import { holdExpiry } from "../utils/hold-expiry";
import { ruleLabel } from "@/utils/ruleLabels";

const VERB: Record<ReviewAction, string> = {
  approve: "capture",
  void: "void",
  refund: "refund",
};

// The rules hold at 30 and block at 70 (risk_rules_processor.rb).
const HOLD_AT = 30;
const BLOCK_AT = 70;

const VERDICT_TONE: Record<string, string> = {
  approve:
    "bg-success-100 text-success-800 dark:bg-success-500/15 dark:text-success-300",
  review:
    "bg-warning-100 text-warning-800 dark:bg-warning-500/15 dark:text-warning-300",
  block:
    "bg-danger-100 text-danger-800 dark:bg-danger-500/15 dark:text-danger-300",
};

interface ReviewCardProps {
  payment: HeldPayment;
  busy: boolean;
  canAct: boolean;
  // The largest amount this person may decide alone; null or missing means no limit.
  limit?: number | null;
  onAct: (id: string, action: ReviewAction, note: string) => void;
  onNote?: (id: string, note: string, proposal?: ReviewAction) => void;
}

/** A 0 to 100 bar with the hold and block lines marked. */
function ScoreBar({
  value,
  label,
  marks = [],
}: {
  value: number;
  label: string;
  marks?: number[];
}) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= BLOCK_AT
      ? "bg-danger-500"
      : pct >= HOLD_AT
        ? "bg-warning-500"
        : "bg-success-500";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="relative mt-3 h-1.5 rounded-full bg-neutral-200 dark:bg-white/10"
    >
      <div
        className={cn("h-full rounded-full", tone)}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
      {marks.map((m) => (
        <span
          key={m}
          aria-hidden="true"
          className="absolute -top-1 h-3.5 w-px bg-neutral-400 dark:bg-neutral-500"
          style={{ left: `${m}%` }}
        />
      ))}
    </div>
  );
}

function Signal({
  icon: Icon,
  title,
  value,
  accent,
  children,
}: {
  icon: typeof ListChecks;
  title: string;
  value: ReactNode;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border p-4",
        accent
          ? "border-accent-500/25 bg-accent-500/[0.05] dark:border-accent-400/20 dark:bg-accent-500/[0.07]"
          : "border-neutral-200 bg-neutral-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            accent && "text-accent-500 dark:text-accent-300",
          )}
          aria-hidden="true"
        />
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
        {value}
      </div>
      <div className="mt-1 flex-1 text-sm text-neutral-600 dark:text-neutral-400">
        {children}
      </div>
    </section>
  );
}

export function ReviewCard({
  payment,
  busy,
  canAct,
  limit = null,
  onAct,
  onNote,
}: ReviewCardProps) {
  const [note, setNote] = useState("");
  const noteId = `note-${payment.id}`;
  const expiry = holdExpiry(payment.authorization_expires_at);
  const overLimit = canAct && limit !== null && payment.amount > limit;
  const notes = payment.notes ?? [];
  const verdict = payment.ai_verdict;
  const timeline = verdict?.timeline ?? [];

  return (
    <Card className="overflow-hidden">
      {/* Header: what this is and how long it can wait */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6 dark:border-white/[0.06]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-500/15 dark:text-warning-300">
              <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
              Held for a person
            </span>
            {payment.agent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                <Bot className="h-3 w-3" aria-hidden="true" />
                Agent payment
              </span>
            )}
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
            {formatMoney(payment.amount)}
          </div>
          <div className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
            {payment.user_email} on{" "}
            {new Date(payment.created_at).toLocaleString()}
          </div>
        </div>
        {expiry && (
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
              expiry.urgent
                ? "bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-white/[0.05] dark:text-neutral-400",
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {expiry.label}
            {expiry.urgent &&
              ": decide now, it is voided automatically before it lapses"}
          </p>
        )}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {payment.action_reason && (
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-warning-600 dark:text-warning-400"
              aria-hidden="true"
            />
            <span>
              <span className="text-neutral-500 dark:text-neutral-400">
                Held because:{" "}
              </span>
              <span className="font-medium">{payment.action_reason}</span>
            </span>
          </p>
        )}

        {payment.agent && <AgentContextPanel agent={payment.agent} />}

        {/* Three independent reads of the same payment */}
        <div className="grid gap-3 md:grid-cols-3">
          <Signal
            icon={ListChecks}
            title="Rules"
            value={
              <>
                score {payment.risk_score}
                <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  / 100
                </span>
              </>
            }
          >
            <ScoreBar
              value={payment.risk_score}
              label="Rules score"
              marks={[HOLD_AT, BLOCK_AT]}
            />
            {payment.rules_triggered.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {payment.rules_triggered.map((rule) => (
                  <li
                    key={rule}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300"
                  >
                    {ruleLabel(rule)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3">No rule fired.</p>
            )}
          </Signal>

          <Signal
            icon={Cpu}
            title="Model"
            value={
              payment.ml_score !== null
                ? `${Math.round(payment.ml_score * 100)}% risk`
                : "Not scored"
            }
          >
            {payment.ml_score !== null ? (
              <>
                <ScoreBar value={payment.ml_score * 100} label="Model risk" />
                <p className="mt-3">
                  A second score from a model trained on labelled payments. It
                  can ask for a hold, never a block.
                </p>
              </>
            ) : (
              <p>The model did not score this payment.</p>
            )}
          </Signal>

          <Signal
            icon={Sparkles}
            title="AI analyst"
            accent
            value={
              verdict ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-sm font-semibold capitalize",
                      VERDICT_TONE[verdict.action] ?? VERDICT_TONE.review,
                    )}
                  >
                    {verdict.action}
                  </span>
                  <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                    {Math.round(verdict.confidence * 100)}% confident
                  </span>
                </span>
              ) : (
                "Not read"
              )
            }
          >
            {verdict ? (
              <>
                <p className="text-neutral-700 dark:text-neutral-300">
                  {verdict.explanation}
                </p>
                <GroundingNote grounding={verdict.grounding} />
              </>
            ) : (
              <p>Did not read this payment.</p>
            )}
          </Signal>
        </div>

        {timeline.length > 0 && (
          <details className="group rounded-xl border border-neutral-200 px-4 py-3 dark:border-white/[0.06]">
            <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-neutral-400 transition-transform group-open:rotate-90">
                  &#8250;
                </span>
                Evidence the analyst weighed ({timeline.length})
              </span>
            </summary>
            <div className="mt-3">
              <CaseTimeline entries={timeline} />
            </div>
          </details>
        )}

        <div className="rounded-xl border border-neutral-200 px-4 pb-4 pt-1 dark:border-white/[0.06]">
          <InvestigatePanel paymentId={payment.id} />
        </div>

        {notes.length > 0 && (
          <ul className="space-y-1.5 text-sm" aria-label="Notes on this case">
            {notes.map((n) => (
              <li
                key={`${n.created_at}-${n.event_type}`}
                className="border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
              >
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {n.actor ?? "Someone"}
                  {n.role ? ` (${n.role})` : ""}
                </span>{" "}
                {n.event_type === "CUSTOMER_APPEAL"
                  ? "wrote"
                  : n.proposal
                    ? `proposes to ${VERB[n.proposal as ReviewAction] ?? n.proposal}`
                    : "noted"}
                {n.text ? `: ${n.text}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Decision */}
      <div className="border-t border-neutral-200 bg-neutral-50/70 px-5 py-4 sm:px-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {payment.pending_request ? (
          <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
            Waiting for an admin: {payment.pending_request.requested_by} asked
            to {VERB[payment.pending_request.action]} the payment
            {payment.pending_request.reason
              ? ` (${payment.pending_request.reason})`
              : ""}
            . It is settled on the Approvals page.
          </p>
        ) : canAct ? (
          <div className="space-y-3">
            {overLimit && (
              <p className="text-sm text-warning-700 dark:text-warning-400">
                This payment is over your decision limit of{" "}
                {formatMoney(limit ?? 0)}. You can ask an admin to decide it;
                nothing moves until they do.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor={noteId}>
                {overLimit
                  ? "Why should it be captured or voided?"
                  : "Note for the audit log (optional)"}
              </Label>
              <Textarea
                id={noteId}
                value={note}
                maxLength={200}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Capture charges the buyer at PayPal. Void releases the hold.
                Both are written to the audit log.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => onAct(payment.id, "void", note)}
                >
                  {overLimit ? "Ask an admin to void" : "Void at PayPal"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => onAct(payment.id, "approve", note)}
                >
                  {overLimit ? "Ask an admin to capture" : "Capture at PayPal"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Only an admin or reviewer can capture or void.
          </p>
        )}

        {onNote && !canAct && (
          <div className="mt-3 space-y-2">
            <Label htmlFor={noteId}>Note or recommendation</Label>
            <Textarea
              id={noteId}
              value={note}
              maxLength={200}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || !note.trim()}
                onClick={() => onNote(payment.id, note)}
              >
                Add note
              </Button>
              {(["approve", "void"] as ReviewAction[]).map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  disabled={busy}
                  onClick={() => onNote(payment.id, note, p)}
                >
                  Propose {VERB[p]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
