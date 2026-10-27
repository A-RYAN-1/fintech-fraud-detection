import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Textarea,
} from "@/components/ui";
import type { HeldPayment, ReviewAction } from "../api";
import { CaseTimeline } from "./CaseTimeline";

interface ReviewCardProps {
  payment: HeldPayment;
  busy: boolean;
  canAct: boolean;
  onAct: (id: string, action: ReviewAction, note: string) => void;
}

export function ReviewCard({ payment, busy, canAct, onAct }: ReviewCardProps) {
  const [note, setNote] = useState("");
  const noteId = `note-${payment.id}`;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">
              $
              {payment.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="text-sm text-neutral-500">
              {payment.user_email} on{" "}
              {new Date(payment.created_at).toLocaleString()}
            </div>
          </div>
          <Badge variant="outline">Risk {payment.risk_score}</Badge>
        </div>

        {payment.action_reason && (
          <p className="text-sm">
            <span className="text-neutral-500">Held because: </span>
            {payment.action_reason}
          </p>
        )}

        {payment.rules_triggered.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {payment.rules_triggered.map((rule) => (
              <Badge key={rule} variant="info">
                {rule}
              </Badge>
            ))}
          </div>
        )}

        {payment.ai_verdict && (
          <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <div className="mb-1 font-medium">
              AI analyst: {payment.ai_verdict.action} (
              {Math.round(payment.ai_verdict.confidence * 100)}%)
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">
              {payment.ai_verdict.explanation}
            </p>
            <div className="mt-3">
              <CaseTimeline entries={payment.ai_verdict.timeline} />
            </div>
          </div>
        )}

        {canAct ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={noteId}>Note for the audit log (optional)</Label>
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
                Approve and capture
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onAct(payment.id, "void", note)}
              >
                Void
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Only an admin can approve or void.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
