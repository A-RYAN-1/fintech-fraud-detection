import { formatMoney } from "@/utils/money";
import { useState } from "react";
import { Button, Card, CardContent, Label, Textarea } from "@/components/ui";
import type { HeldPayment, ReviewAction } from "../api";
import { CaseTimeline } from "./CaseTimeline";
import { AccountRingPanel } from "./AccountRingPanel";
import { AskAnalystPanel } from "./AskAnalystPanel";
import { holdExpiry } from "../utils/hold-expiry";
import { ruleLabel } from "@/utils/ruleLabels";

const VERB: Record<ReviewAction, string> = {
  approve: "capture",
  void: "void",
  refund: "refund",
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

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">
              {formatMoney(payment.amount)}
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {payment.user_email} on{" "}
              {new Date(payment.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        {payment.action_reason && (
          <p className="text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Held because:{" "}
            </span>
            {payment.action_reason}
          </p>
        )}

        {expiry && (
          <p
            className={
              expiry.urgent
                ? "text-sm font-medium text-red-600 dark:text-red-400"
                : "text-sm text-neutral-500 dark:text-neutral-400"
            }
          >
            {expiry.label}
            {expiry.urgent &&
              ": decide now, it is voided automatically before it lapses"}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <div className="mb-1 font-medium">
              Rules: score {payment.risk_score}
            </div>
            {payment.rules_triggered.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-neutral-400">
                {payment.rules_triggered.map((rule) => (
                  <li key={rule}>{ruleLabel(rule)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500 dark:text-neutral-400">
                No rule fired.
              </p>
            )}
          </div>
          <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <div className="mb-1 font-medium">
              Model
              {payment.ml_score !== null
                ? `: ${Math.round(payment.ml_score * 100)}% risk`
                : ""}
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">
              {payment.ml_score !== null
                ? "A second score from a model trained on labelled payments. It can ask for a hold, never a block."
                : "The model did not score this payment."}
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            {payment.ai_verdict ? (
              <>
                <div className="mb-1 font-medium">
                  AI analyst: {payment.ai_verdict.action} (
                  {Math.round(payment.ai_verdict.confidence * 100)}%)
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  {payment.ai_verdict.explanation}
                </p>
              </>
            ) : (
              <>
                <div className="mb-1 font-medium">AI analyst</div>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Did not read this payment.
                </p>
              </>
            )}
          </div>
        </div>

        {payment.ai_verdict && (
          <CaseTimeline entries={payment.ai_verdict.timeline} />
        )}

        <div className="flex flex-wrap items-start gap-2">
          <AccountRingPanel paymentId={payment.id} />
          <AskAnalystPanel paymentId={payment.id} />
        </div>

        {notes.length > 0 && (
          <ul className="space-y-1 text-sm">
            {notes.map((n) => (
              <li
                key={`${n.created_at}-${n.event_type}`}
                className="text-neutral-600 dark:text-neutral-400"
              >
                <span className="font-medium">
                  {n.actor ?? "Someone"}
                  {n.role ? ` (${n.role})` : ""}
                </span>{" "}
                {n.proposal
                  ? `proposes to ${VERB[n.proposal as ReviewAction] ?? n.proposal}`
                  : "noted"}
                {n.text ? `: ${n.text}` : ""}
              </li>
            ))}
          </ul>
        )}

        {payment.pending_request ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
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
              <p className="text-sm text-amber-700 dark:text-amber-400">
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
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => onAct(payment.id, "approve", note)}
              >
                {overLimit ? "Ask an admin to capture" : "Capture at PayPal"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onAct(payment.id, "void", note)}
              >
                {overLimit ? "Ask an admin to void" : "Void at PayPal"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Only an admin or reviewer can capture or void.
          </p>
        )}

        {onNote && !canAct && (
          <div className="space-y-2">
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
      </CardContent>
    </Card>
  );
}
