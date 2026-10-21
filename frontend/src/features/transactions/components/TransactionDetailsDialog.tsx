import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Separator,
} from "@/components/ui";
import { cn, formatDateTime } from "@/utils";
import { formatCurrency } from "@/features/dashboard";
import type { Transaction, TransactionStatus } from "@/types";
import MlScoreSection from "./MlScoreSection";

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Normalize status to uppercase
function normalizeStatus(
  status: TransactionStatus,
): "SUCCESS" | "FLAGGED" | "BLOCKED" | "PENDING" {
  return status.toUpperCase() as "SUCCESS" | "FLAGGED" | "BLOCKED" | "PENDING";
}

// Parse amount (backend may return string)
function parseAmount(amount: number | string): number {
  return typeof amount === "string" ? parseFloat(amount) : amount;
}

function getStatusIcon(status: TransactionStatus) {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "SUCCESS":
      return <CheckCircle className="h-5 w-5 text-success-500" />;
    case "FLAGGED":
      return <AlertTriangle className="h-5 w-5 text-warning-500" />;
    case "BLOCKED":
      return <XCircle className="h-5 w-5 text-danger-500" />;
    default:
      return <Shield className="h-5 w-5 text-neutral-500" />;
  }
}

function getStatusBadgeVariant(status: TransactionStatus) {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "SUCCESS":
      return "success";
    case "FLAGGED":
      return "warning";
    case "BLOCKED":
      return "danger";
    default:
      return "default";
  }
}

function getRiskLevel(score: number) {
  if (score >= 70)
    return {
      label: "High Risk",
      color: "text-danger-600 dark:text-danger-400",
    };
  if (score >= 30)
    return {
      label: "Medium Risk",
      color: "text-warning-600 dark:text-warning-400",
    };
  return { label: "Low Risk", color: "text-success-600 dark:text-success-400" };
}

export default function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  if (!transaction) return null;

  const riskScore = transaction.risk_score ?? 0;
  const riskLevel = getRiskLevel(riskScore);
  const rulesTriggered =
    transaction.rules_triggered?.split(",").filter(Boolean) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(transaction.status)}
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount & Status */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(parseAmount(transaction.amount))}
            </span>
            <Badge
              variant={getStatusBadgeVariant(transaction.status)}
              className="text-sm"
            >
              {normalizeStatus(transaction.status)}
            </Badge>
          </div>

          <Separator />

          {/* Risk Score Visualization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Risk Score
              </span>
              <span className={cn("font-bold", riskLevel.color)}>
                {riskScore} - {riskLevel.label}
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  riskScore >= 70
                    ? "bg-danger-500"
                    : riskScore >= 30
                      ? "bg-warning-500"
                      : "bg-success-500",
                )}
                style={{ width: `${Math.min(riskScore, 100)}%` }}
              />
            </div>
          </div>

          {/* Rules Triggered */}
          {rulesTriggered.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Rules Triggered
              </span>
              <div className="flex flex-wrap gap-2">
                {rulesTriggered.map((rule) => (
                  <Badge key={rule} variant="outline" className="text-xs">
                    {rule.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <MlScoreSection
            score={transaction.ml_score}
            reasons={transaction.ml_explanation}
          />

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                Transaction ID
              </span>
              <p className="font-mono text-neutral-900 dark:text-neutral-100 truncate">
                {transaction.id}
              </p>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                Payment Method
              </span>
              <p className="text-neutral-900 dark:text-neutral-100 capitalize">
                {transaction.payment_method.replace("_", " ")}
              </p>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                IP Address
              </span>
              <p className="font-mono text-neutral-900 dark:text-neutral-100">
                {transaction.ip_address}
              </p>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                Date & Time
              </span>
              <p className="text-neutral-900 dark:text-neutral-100">
                {formatDateTime(transaction.created_at)}
              </p>
            </div>
          </div>

          {/* Device ID */}
          <div className="text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">
              Device ID
            </span>
            <p className="font-mono text-xs text-neutral-900 dark:text-neutral-100 break-all">
              {transaction.device_id}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
