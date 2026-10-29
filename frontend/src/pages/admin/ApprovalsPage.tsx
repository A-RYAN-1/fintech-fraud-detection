import { formatMoney } from "@/utils/money";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { useAppSelector } from "@/store";
import {
  useApprovalRequests,
  useCapturedPayments,
  useRequestRefund,
  useSettleRequest,
  type ApprovalRequest,
} from "@/features/review";

const ACTION_LABEL: Record<string, string> = {
  approve: "Capture",
  void: "Void",
  refund: "Refund",
};

function RequestRow({
  request,
  canSettle,
  busy,
  onSettle,
}: {
  request: ApprovalRequest;
  canSettle: boolean;
  busy: boolean;
  onSettle: (id: number, decision: "approve" | "reject", note: string) => void;
}) {
  const [note, setNote] = useState("");
  const noteId = `settle-note-${request.id}`;

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">
            {ACTION_LABEL[request.action]}{" "}
            {formatMoney(request.amount ?? request.payment.amount)}
            {request.action === "refund" &&
              request.amount !== null &&
              request.amount < request.payment.amount &&
              ` of ${formatMoney(request.payment.amount)}`}
          </div>
          <div className="text-sm text-neutral-500">
            {request.payment.user_email}, asked by {request.requested_by} on{" "}
            {new Date(request.created_at).toLocaleString()}
          </div>
        </div>
        <Badge
          variant={
            request.status === "pending"
              ? "warning"
              : request.status === "approved"
                ? "success"
                : "default"
          }
          className="capitalize"
        >
          {request.status}
        </Badge>
      </div>
      {request.reason && (
        <p className="text-sm">
          <span className="text-neutral-500">Reason: </span>
          {request.reason}
        </p>
      )}
      {request.status !== "pending" && (
        <p className="text-sm text-neutral-500">
          {request.status === "approved" ? "Approved" : "Rejected"} by{" "}
          {request.decided_by}
          {request.decided_at
            ? ` on ${new Date(request.decided_at).toLocaleString()}`
            : ""}
          {request.decision_note ? `: ${request.decision_note}` : ""}
        </p>
      )}
      {request.status === "pending" && canSettle && (
        <div className="space-y-2">
          <Label htmlFor={noteId}>Note (optional)</Label>
          <Textarea
            id={noteId}
            value={note}
            maxLength={200}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => onSettle(request.id, "approve", note)}
            >
              Approve and carry out
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onSettle(request.id, "reject", note)}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RefundRow({
  id,
  userEmail,
  amount,
  refunded,
  pending,
  busy,
  onRequest,
}: {
  id: string;
  userEmail: string;
  amount: number;
  refunded: number;
  pending: boolean;
  busy: boolean;
  onRequest: (id: string, amount: string, note: string) => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const left = amount - refunded;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 sm:flex-row sm:items-end dark:border-neutral-800">
      <div className="flex-1">
        <div className="font-medium">{formatMoney(amount)}</div>
        <div className="text-sm text-neutral-500">
          {userEmail}, {formatMoney(left)} left to refund
        </div>
      </div>
      {pending ? (
        <span className="text-sm text-amber-700 dark:text-amber-400">
          A refund is waiting for an admin
        </span>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor={`refund-amount-${id}`}>Amount (blank is all)</Label>
            <Input
              id={`refund-amount-${id}`}
              inputMode="decimal"
              className="sm:w-32"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`refund-note-${id}`}>Reason</Label>
            <Input
              id={`refund-note-${id}`}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onRequest(id, value, note)}
          >
            Request refund
          </Button>
        </>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin";
  const canRequest = isAdmin || user?.role === "reviewer";
  const pending = useApprovalRequests("pending");
  const recent = useApprovalRequests("all");
  const captured = useCapturedPayments();
  const settle = useSettleRequest();
  const refund = useRequestRefund();

  const pendingRows = pending.data?.approval_requests ?? [];
  const historyRows = (recent.data?.approval_requests ?? []).filter(
    (r) => r.status !== "pending",
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Approvals"
          description="Decisions above a reviewer's limit and every refund need a second person. One asks, a different admin settles; nothing moves until then."
        />

        <Card>
          <CardHeader>
            <CardTitle>Waiting for an admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : pendingRows.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Nothing waiting"
                description="Requests appear here when a reviewer goes over their limit or asks for a refund."
              />
            ) : (
              pendingRows.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  canSettle={isAdmin && request.requested_by !== user?.email}
                  busy={settle.isPending}
                  onSettle={(id, decision, note) =>
                    settle.mutate({ id, decision, note })
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {canRequest && (
          <Card>
            <CardHeader>
              <CardTitle>Refund a captured payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {captured.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (captured.data?.held ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No captured payments to refund.
                </p>
              ) : (
                (captured.data?.held ?? []).map((payment) => (
                  <RefundRow
                    key={payment.id}
                    id={payment.id}
                    userEmail={payment.user_email}
                    amount={payment.amount}
                    refunded={payment.refunded_amount}
                    pending={payment.pending_request !== null}
                    busy={refund.isPending}
                    onRequest={(id, amount, note) =>
                      refund.mutate({ id, amount, note })
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        )}

        {historyRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Settled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyRows.slice(0, 10).map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  canSettle={false}
                  busy={false}
                  onSettle={() => undefined}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
