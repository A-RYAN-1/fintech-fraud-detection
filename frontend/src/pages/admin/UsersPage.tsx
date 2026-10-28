import { useState } from "react";
import { Search, Users } from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { PageTransition, EmptyState } from "@/components/common";
import {
  UserTable,
  useUsers,
  useUpdateUserLimit,
  useUpdateUserRole,
  useUpdateUserStatus,
} from "@/features/admin";
import { useAppSelector } from "@/store";
import { Pagination } from "@/features/transactions";

const PER_PAGE = 10;

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const currentUser = useAppSelector((state) => state.auth.user);
  const { data, isLoading } = useUsers({
    page,
    per_page: PER_PAGE,
    role: roleFilter === "all" ? undefined : roleFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: searchQuery.trim() || undefined,
  });
  const updateStatus = useUpdateUserStatus();
  const updateRole = useUpdateUserRole();
  const updateLimit = useUpdateUserLimit();

  const users = data?.users ?? [];
  const totalCount = data?.pagination.total_count ?? 0;
  const totalPages = data?.pagination.total_pages ?? 0;

  const handleUpdateStatus = (userId: string, status: string) =>
    updateStatus.mutate({ userId, status });
  const handleUpdateRole = (userId: string, role: string) =>
    updateRole.mutate({ userId, role });
  const handleUpdateLimit = (userId: string, limit: string) =>
    updateLimit.mutate({ userId, limit });

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            User Management
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Manage user accounts, roles, and permissions
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
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                {totalCount} User{totalCount !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 && !isLoading ? (
                <EmptyState
                  icon={Users}
                  title="No users found"
                  description="Try adjusting your search or filter criteria"
                />
              ) : (
                <>
                  <UserTable
                    users={users}
                    isLoading={isLoading}
                    canManage={currentUser?.role === "admin"}
                    onUpdateStatus={handleUpdateStatus}
                    onUpdateRole={handleUpdateRole}
                    onUpdateLimit={handleUpdateLimit}
                  />
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
