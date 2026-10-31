import { formatMoney } from "@/utils/money";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { useAppSelector } from "@/store";
import {
  useRuleProposals,
  useSettleProposal,
  type BacktestMetrics,
  type RuleProposal,
} from "@/features/rules";

const ROWS: {
  key: keyof BacktestMetrics;
  label: string;
  good: "down" | "none";
}[] = [
  {
    key: "false_alarms",
    label: "False alarms (held, then approved by a person)",
    good: "down",
  },
  {
    key: "misses",
    label: "Misses (approved, then blocked by a person)",
    good: "down",
  },
  { key: "success", label: "Approved", good: "none" },
  { key: "flagged", label: "Held for review", good: "none" },
  { key: "blocked", label: "Blocked", good: "none" },
];

function change(value: number, good: "down" | "none") {
  if (value === 0)
    return (
      <span className="text-neutral-500 dark:text-neutral-400">no change</span>
    );
  const sign = value > 0 ? "+" : "";
  const tone =
    good === "down"
      ? value < 0
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-red-700 dark:text-red-400"
      : "";
  return <span className={tone}>{`${sign}${value}`}</span>;
}

function BacktestTable({ proposal }: { proposal: RuleProposal }) {
  const { backtest } = proposal;
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Backtest of the proposed change over stored payments
        </caption>
        <thead>
          <tr className="text-left text-neutral-500 dark:text-neutral-400">
            <th scope="col" className="py-1 pr-2 font-normal">
              Over {backtest.replayed} stored payments
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              Now
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              With change
            </th>
            <th scope="col" className="py-1 pl-2 text-right font-normal">
              Difference
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.key}
              className="border-t border-neutral-200 dark:border-neutral-800"
            >
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                {row.label}
              </th>
              <td className="px-2 py-1 text-right tabular-nums">
                {backtest.baseline[row.key]}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {backtest.candidate[row.key]}
              </td>
              <td className="py-1 pl-2 text-right tabular-nums">
                {change(backtest.delta[row.key], row.good)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {backtest.labelled} of these payments have a human decision.
        {backtest.fidelity.rate !== null &&
          ` Replaying the current rules reproduces ${Math.round(backtest.fidelity.rate * 100)}% of the stored outcomes.`}{" "}
        {backtest.notes}
      </p>
      {backtest.flips.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
            Payments that would change ({backtest.flips.length} shown)
          </summary>
          <ul className="mt-1 space-y-1">
            {backtest.flips.map((flip) => (
              <li key={flip.transaction_id}>
                {formatMoney(flip.amount)}: {flip.from.toLowerCase()} to{" "}
                {flip.to.toLowerCase()}
                {flip.human_label && `, a person decided ${flip.human_label}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  canSettle,
  busy,
  onSettle,
}: {
  proposal: RuleProposal;
  canSettle: boolean;
  busy: boolean;
  onSettle: (id: number, decision: "accept" | "reject", note: string) => void;
}) {
  const [note, setNote] = useState("");
  const noteId = `proposal-note-${proposal.id}`;

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{proposal.description}</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            <code>{proposal.key}</code>: {proposal.current_value} to{" "}
            <strong className="text-neutral-900 dark:text-neutral-100">
              {proposal.proposed_value}
            </strong>
          </div>
        </div>
        <Badge
          variant={
            proposal.status === "pending"
              ? "warning"
              : proposal.status === "accepted"
                ? "success"
                : "default"
          }
          className="capitalize"
        >
          {proposal.status}
        </Badge>
      </div>
      <p className="text-sm">{proposal.rationale}</p>
      <BacktestTable proposal={proposal} />
      {proposal.status !== "pending" && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {proposal.status === "superseded"
            ? "Not applied: the rule changed after this was drafted."
            : `${proposal.status === "accepted" ? "Accepted" : "Rejected"} by ${proposal.decided_by}`}
          {proposal.decided_at
            ? ` on ${new Date(proposal.decided_at).toLocaleString()}`
            : ""}
          {proposal.decision_note ? `: ${proposal.decision_note}` : ""}
        </p>
      )}
      {proposal.status === "pending" && canSettle && (
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
              onClick={() => onSettle(proposal.id, "accept", note)}
            >
              Accept and change the rule
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onSettle(proposal.id, "reject", note)}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RuleProposalsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin";
  const all = useRuleProposals("all");
  const settle = useSettleProposal();

  const rows = all.data?.rule_proposals ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending");

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Rule changes"
          description="When a person overrides the rules, the agent drafts one change to one rule and tests it on every stored payment. It never edits a live rule: only an admin accepting a draft does."
        />

        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin ? "Waiting for you" : "Waiting for an admin"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {all.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : pending.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No drafts waiting"
                description="A draft appears here after a reviewer approves a payment the rules held, or blocks one the rules approved."
              />
            ) : (
              pending.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  canSettle={isAdmin}
                  busy={settle.isPending}
                  onSettle={(id, decision, note) =>
                    settle.mutate({ id, decision, note })
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Settled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.slice(0, 10).map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
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
