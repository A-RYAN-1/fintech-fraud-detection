import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  LogIn,
  FileText,
} from "lucide-react";
import { Badge, Skeleton } from "@/components/ui";
import { formatShortDateTime, formatRelativeTime } from "@/utils";
import type { AuditLog } from "../api";

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading?: boolean;
}

function getEventIcon(eventType: string) {
  if (eventType.includes("BLOCKED"))
    return <XCircle className="h-4 w-4 text-danger-500" />;
  if (eventType.includes("FLAGGED"))
    return <AlertTriangle className="h-4 w-4 text-warning-500" />;
  if (eventType.includes("SUCCESS"))
    return <CheckCircle className="h-4 w-4 text-success-500" />;
  if (eventType.includes("LOGIN"))
    return <LogIn className="h-4 w-4 text-primary-500" />;
  if (eventType.includes("USER"))
    return <User className="h-4 w-4 text-primary-500" />;
  return <FileText className="h-4 w-4 text-neutral-500" />;
}

function getEventBadgeVariant(eventType: string) {
  if (eventType.includes("BLOCKED")) return "danger";
  if (eventType.includes("FLAGGED")) return "warning";
  if (eventType.includes("SUCCESS")) return "success";
  return "default";
}

function formatState(state: Record<string, unknown>) {
  return Object.entries(state)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

export default function AuditLogTable({
  logs,
  isLoading = false,
}: AuditLogTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg"
          >
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">
          No audit logs found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <div className="shrink-0 h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            {getEventIcon(log.event_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={getEventBadgeVariant(log.event_type)}
                className="text-xs"
              >
                {log.event_type.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {log.entity_type} • {log.entity_id.slice(0, 8)}...
              </span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {log.description || "No description"}
            </p>
            {(log.actor || log.before || log.after) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                {log.actor && (
                  <span>
                    By {log.actor}
                    {log.actor_role ? ` (${log.actor_role})` : ""}
                  </span>
                )}
                {log.before && (
                  <span className="font-mono">
                    before {formatState(log.before)}
                  </span>
                )}
                {log.after && (
                  <span className="font-mono">
                    after {formatState(log.after)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatShortDateTime(log.created_at)}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              {formatRelativeTime(log.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
