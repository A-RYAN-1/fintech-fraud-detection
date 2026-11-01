import { useState, type FormEvent } from "react";
import { Bot, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, EmptyState, PageHeader } from "@/components/common";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@/components/ui";
import { formatMoney } from "@/utils/money";
import {
  useAgentMandates,
  useCreateMandate,
  useRevokeMandate,
  type AgentMandate,
  type MandateStatus,
} from "@/features/agents";

const DEFAULT_MERCHANT = "Sentrix Demo Store";

const STATUS_VARIANT: Record<
  MandateStatus,
  "success" | "warning" | "danger" | "default"
> = {
  active: "success",
  exhausted: "warning",
  expired: "default",
  revoked: "danger",
};

function MandateRow({
  mandate,
  showOwner,
  busy,
  onRevoke,
}: {
  mandate: AgentMandate;
  showOwner: boolean;
  busy: boolean;
  onRevoke: (id: number) => void;
}) {
  const total = parseFloat(mandate.total_cap);
  const spent = parseFloat(mandate.spent_amount);
  const percent = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium">{mandate.label}</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {mandate.merchant}
            {showOwner && mandate.owner_email
              ? `, given by ${mandate.owner_email}`
              : ""}
            , token ending {mandate.token_hint}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[mandate.status]} className="capitalize">
          {mandate.status}
        </Badge>
      </div>
      <div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          role="progressbar"
          aria-label={`Spent of the ${mandate.label} mandate`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={spent}
        >
          <div
            className="h-full bg-primary-600"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span>
            {formatMoney(spent)} of {formatMoney(total)} used,{" "}
            {formatMoney(mandate.remaining)} left
          </span>
          <span>Up to {formatMoney(mandate.per_payment_cap)} a payment</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        <span>
          {mandate.status === "revoked" && mandate.revoked_at
            ? `Revoked ${new Date(mandate.revoked_at).toLocaleString()}`
            : `Expires ${new Date(mandate.expires_at).toLocaleString()}`}
          {mandate.last_used_at
            ? `, last used ${new Date(mandate.last_used_at).toLocaleString()}`
            : ", not used yet"}
        </span>
        {mandate.status === "active" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onRevoke(mandate.id)}
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const mandates = useAgentMandates();
  const create = useCreateMandate();
  const revoke = useRevokeMandate();

  const [label, setLabel] = useState("");
  const [merchant, setMerchant] = useState(DEFAULT_MERCHANT);
  const [perPayment, setPerPayment] = useState("50");
  const [total, setTotal] = useState("200");
  const [days, setDays] = useState("7");
  const [token, setToken] = useState<string | null>(null);

  const rows = mandates.data?.mandates ?? [];
  const showOwner = mandates.data?.scope === "all";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        label: label.trim(),
        merchant: merchant.trim(),
        per_payment_cap: perPayment,
        total_cap: total,
        expires_in_days: Number(days) || 7,
      },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setLabel("");
        },
      },
    );
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copied");
    } catch {
      toast.error("Could not copy. Select the token and copy it by hand.");
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Agents"
          description="Let a shopping agent pay for you inside written limits: one merchant, a cap per payment, a cap in total, an end date. You can revoke it at any moment."
        />

        {token && (
          <Alert variant="warning" title="Copy this token now">
            <div className="space-y-2">
              <p>It is shown once and cannot be read again.</p>
              <code
                data-testid="mandate-token"
                className="block break-all rounded bg-neutral-100 p-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {token}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy token
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setToken(null)}
                >
                  I have saved it
                </Button>
              </div>
              <p>
                The agent sends it as <code>Authorization: Bearer ...</code> to{" "}
                <code>POST /api/v1/agent/payments</code> with an amount and the
                merchant. Payments are simulated: no money moves.
              </p>
            </div>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Give an agent a mandate</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onSubmit}
              className="grid gap-4 sm:grid-cols-2"
              aria-label="New mandate"
            >
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="mandate-label">Agent name</Label>
                <Input
                  id="mandate-label"
                  required
                  maxLength={80}
                  placeholder="Groceries agent"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="mandate-merchant">Allowed merchant</Label>
                <Input
                  id="mandate-merchant"
                  required
                  maxLength={120}
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mandate-per">Most per payment (USD)</Label>
                <Input
                  id="mandate-per"
                  required
                  inputMode="decimal"
                  value={perPayment}
                  onChange={(e) => setPerPayment(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mandate-total">Most in total (USD)</Label>
                <Input
                  id="mandate-total"
                  required
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mandate-days">Valid for (days, up to 30)</Label>
                <Input
                  id="mandate-days"
                  required
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={create.isPending}>
                  Create mandate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {showOwner ? "All mandates" : "Your mandates"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mandates.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No mandates yet"
                description="Create one above. Every payment an agent makes still goes through the risk rules and the analyst."
              />
            ) : (
              rows.map((mandate) => (
                <MandateRow
                  key={mandate.id}
                  mandate={mandate}
                  showOwner={showOwner}
                  busy={revoke.isPending}
                  onRevoke={(id) => revoke.mutate(id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
