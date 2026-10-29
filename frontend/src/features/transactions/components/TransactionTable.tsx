import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Eye, MessageSquare, ArrowUpDown } from "lucide-react";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@/components/ui";
import { cn, formatDateTime } from "@/utils";
import { formatCurrency } from "@/features/dashboard";
import { actionTaken, formatMlScore } from "../utils/payment-labels";
import type { Transaction, TransactionStatus } from "@/types";

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewDetails: (transaction: Transaction) => void;
  onSubmitFeedback: (transaction: Transaction) => void;
}

type SortField = "created_at" | "amount" | "risk_score";
type SortOrder = "asc" | "desc";

// Normalize status to uppercase
function normalizeStatus(
  status: TransactionStatus,
): "SUCCESS" | "FLAGGED" | "BLOCKED" | "PENDING" {
  return status.toUpperCase() as "SUCCESS" | "FLAGGED" | "BLOCKED" | "PENDING";
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

// Parse amount (backend may return string)
function parseAmount(amount: number | string): number {
  return typeof amount === "string" ? parseFloat(amount) : amount;
}

export default function TransactionTable({
  transactions,
  isLoading = false,
  onViewDetails,
  onSubmitFeedback,
}: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "created_at":
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "amount":
        comparison = parseAmount(a.amount) - parseAmount(b.amount);
        break;
      case "risk_score":
        comparison = (a.risk_score ?? 0) - (b.risk_score ?? 0);
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">
          No payments yet
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Make a payment on the{" "}
          <Link
            to="/pay"
            className="font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
          >
            Pay page
          </Link>{" "}
          and it appears here with its verdict.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              ID
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort("amount")}
                className="flex items-center gap-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Amount
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort("risk_score")}
                className="flex items-center gap-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Rules score
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              ML score
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              AI verdict
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Action taken
            </th>
            <th className="text-left py-3 px-4">
              <button
                onClick={() => handleSort("created_at")}
                className="flex items-center gap-1 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Date
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((transaction) => (
            <tr
              key={transaction.id}
              className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td className="py-3 px-4">
                <span className="text-sm font-mono text-neutral-600 dark:text-neutral-400">
                  {transaction.id.slice(0, 12)}...
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(parseAmount(transaction.amount))}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "text-sm font-medium",
                    (transaction.risk_score ?? 0) >= 70
                      ? "text-danger-600 dark:text-danger-400"
                      : (transaction.risk_score ?? 0) >= 30
                        ? "text-warning-600 dark:text-warning-400"
                        : "text-success-600 dark:text-success-400",
                  )}
                >
                  {transaction.risk_score ?? 0}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                {formatMlScore(transaction.ml_score)}
              </td>
              <td className="py-3 px-4 text-sm">
                {transaction.ai_verdict ? (
                  <span>
                    {transaction.ai_verdict.action}{" "}
                    <span className="text-neutral-500">
                      {Math.round(transaction.ai_verdict.confidence * 100)}%
                    </span>
                  </span>
                ) : (
                  <span className="text-neutral-500">-</span>
                )}
              </td>
              <td className="py-3 px-4">
                <Badge variant={getStatusBadgeVariant(transaction.status)}>
                  {actionTaken(transaction)}
                </Badge>
                {transaction.simulated && (
                  <span className="ml-2 text-xs text-neutral-500">
                    simulated
                  </span>
                )}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {formatDateTime(transaction.created_at)}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onViewDetails(transaction)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {!transaction.feedback_submitted && (
                      <DropdownMenuItem
                        onClick={() => onSubmitFeedback(transaction)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Submit Feedback
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
