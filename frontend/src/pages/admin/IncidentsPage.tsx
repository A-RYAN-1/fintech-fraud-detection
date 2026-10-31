import { useState } from "react";
import { Siren } from "lucide-react";
import { toast } from "sonner";
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
  useDecideIncident,
  useIncidents,
  useScanIncidents,
  useSuggestCause,
  type Incident,
} from "@/features/incidents";

const KIND_LABEL: Record<Incident["kind"], string> = {
  paypal_error: "PayPal",
  job_failed: "Background job",
  analyst: "AI analyst",
};

function when(value: string) {
  return new Date(value).toLocaleString();
}

function IncidentCard({
  incident,
  isAdmin,
  busy,
  onDecide,
  onSuggest,
}: {
  incident: Incident;
  isAdmin: boolean;
  busy: boolean;
  onDecide: (
    id: number,
    decision: "approve" | "dismiss",
    note: string,
    issueUrl: string,
  ) => void;
  onSuggest: (id: number) => void;
}) {
  const [note, setNote] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const isOpen = incident.status === "open";
  const noteId = `incident-note-${incident.id}`;
  const urlId = `incident-url-${incident.id}`;

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{incident.title}</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {KIND_LABEL[incident.kind]}: {incident.occurrences} time
            {incident.occurrences === 1 ? "" : "s"}, first{" "}
            {when(incident.first_seen_at)}, last {when(incident.last_seen_at)}
            {incident.recurrences > 0 &&
              `, came back ${incident.recurrences} time${incident.recurrences === 1 ? "" : "s"} after a report`}
          </div>
        </div>
        <Badge
          variant={
            isOpen
              ? "warning"
              : incident.status === "reported"
                ? "success"
                : "default"
          }
          className="capitalize"
        >
          {incident.status}
        </Badge>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {Object.entries(incident.sample).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="text-neutral-500 dark:text-neutral-400">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="break-all">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {incident.detail && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Last message: {incident.detail}
        </p>
      )}
      {incident.ai_note && (
        <p className="rounded-md bg-neutral-50 p-2 text-sm dark:bg-neutral-900">
          <strong>AI analyst suggestion (not verified).</strong>{" "}
          {incident.ai_note}
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">
          Drafted GitHub issue
        </summary>
        <p className="mt-2 font-medium">{incident.draft.title}</p>
        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
          {incident.draft.body}
        </pre>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard
                ?.writeText(`${incident.draft.title}\n\n${incident.draft.body}`)
                .then(() => toast.success("Issue text copied"))
                .catch(() => toast.error("Could not copy"));
            }}
          >
            Copy text
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={incident.draft.new_issue_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the GitHub issue form
            </a>
          </Button>
        </div>
      </details>

      {!isOpen && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {incident.status === "reported" ? "Approved" : "Dismissed"} by{" "}
          {incident.decided_by}
          {incident.decided_at ? ` on ${when(incident.decided_at)}` : ""}
          {incident.decision_note ? `: ${incident.decision_note}` : ""}
          {incident.issue_url && (
            <>
              {" "}
              <a
                className="underline"
                href={incident.issue_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Issue
              </a>
            </>
          )}
        </p>
      )}

      {isOpen && isAdmin && (
        <div className="space-y-2">
          <Label htmlFor={noteId}>Note (optional)</Label>
          <Textarea
            id={noteId}
            value={note}
            maxLength={200}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
          />
          <Label htmlFor={urlId}>
            Issue link, once you filed it (optional)
          </Label>
          <Input
            id={urlId}
            value={issueUrl}
            placeholder="https://github.com/..."
            onChange={(e) => setIssueUrl(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => onDecide(incident.id, "approve", note, issueUrl)}
            >
              Approve the report
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onDecide(incident.id, "dismiss", note, "")}
            >
              Dismiss
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => onSuggest(incident.id)}
            >
              Ask the AI analyst for a likely cause
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === "admin";
  const all = useIncidents();
  const scan = useScanIncidents();
  const decide = useDecideIncident();
  const suggest = useSuggestCause();

  const rows = all.data?.incidents ?? [];
  const open = rows.filter((row) => row.status === "open");
  const settled = rows.filter((row) => row.status !== "open");
  const busy = decide.isPending || suggest.isPending;

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Incidents"
          description="Failed PayPal calls, failed background jobs and AI analyst failures, grouped by what went wrong and counted. The agent drafts the report; only an admin approves it, and it never files an issue, edits code or touches a payment."
        />

        <Card>
          <CardHeader>
            <CardTitle>Digest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {all.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <pre className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                {all.data?.digest}
              </pre>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={scan.isPending}
                onClick={() => scan.mutate()}
              >
                {scan.isPending ? "Scanning..." : "Scan now"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!all.data}
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(all.data?.digest ?? "")
                    .then(() => toast.success("Digest copied"))
                    .catch(() => toast.error("Could not copy"));
                }}
              >
                Copy digest
              </Button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              A scan also runs every 30 minutes. Failed PayPal calls are
              recorded the moment they happen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin ? "Waiting for you" : "Waiting for an admin"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {all.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : all.isError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                The incidents could not be loaded.
              </p>
            ) : open.length === 0 ? (
              <EmptyState
                icon={Siren}
                title="No open incidents"
                description="Nothing failed that a person has not already handled."
              />
            ) : (
              open.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  isAdmin={isAdmin}
                  busy={busy}
                  onDecide={(id, decision, note, issueUrl) =>
                    decide.mutate({ id, decision, note, issueUrl })
                  }
                  onSuggest={(id) => suggest.mutate(id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {settled.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Handled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settled.slice(0, 10).map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  isAdmin={false}
                  busy={false}
                  onDecide={() => undefined}
                  onSuggest={() => undefined}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
