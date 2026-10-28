import { useState } from "react";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { PageTransition, EmptyState } from "@/components/common";
import { AuditLogTable, useAuditLogs } from "@/features/admin";
import { Pagination } from "@/features/transactions";

const PER_PAGE = 10;

export default function AuditLogsPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs({
    page,
    per_page: PER_PAGE,
    event_type: eventTypeFilter === "all" ? undefined : eventTypeFilter,
    entity_type: entityTypeFilter === "all" ? undefined : entityTypeFilter,
    actor_role: roleFilter === "all" ? undefined : roleFilter,
  });

  const logs = data?.audit_logs ?? [];
  const totalCount = data?.pagination.total_count ?? 0;
  const totalPages = data?.pagination.total_pages ?? 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Audit Logs
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Track all system activities and changes
          </p>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={eventTypeFilter}
                  onValueChange={(v) => {
                    setEventTypeFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="PAYPAL_CAPTURED">Captured</SelectItem>
                    <SelectItem value="PAYPAL_VOIDED">Voided</SelectItem>
                    <SelectItem value="PAYPAL_REFUNDED">Refunded</SelectItem>
                    <SelectItem value="PAYPAL_HELD">Held</SelectItem>
                    <SelectItem value="REVIEW_NOTE">Notes</SelectItem>
                    <SelectItem value="DECISION_PROPOSED">Proposals</SelectItem>
                    <SelectItem value="USER_ROLE_CHANGED">
                      Role changes
                    </SelectItem>
                    <SelectItem value="USER_DECISION_LIMIT_CHANGED">
                      Limit changes
                    </SelectItem>
                    <SelectItem value="TRANSACTION_BLOCKED">Blocked</SelectItem>
                    <SelectItem value="TRANSACTION_FLAGGED">Flagged</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={entityTypeFilter}
                  onValueChange={(v) => {
                    setEntityTypeFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    <SelectItem value="Transaction">Transaction</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="RiskRule">Risk rule</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Actor role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Audit Logs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                {totalCount} Log Entr{totalCount !== 1 ? "ies" : "y"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 && !isLoading ? (
                <EmptyState
                  icon={FileText}
                  title="No logs found"
                  description="Try adjusting your filter criteria"
                />
              ) : (
                <>
                  <AuditLogTable logs={logs} isLoading={isLoading} />
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      perPage={PER_PAGE}
                      onPageChange={setPage}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}
