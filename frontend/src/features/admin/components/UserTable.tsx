import { useState } from "react";
import { formatMoney } from "@/utils/money";
import dayjs from "dayjs";
import {
  MoreHorizontal,
  Shield,
  User as UserIcon,
  Ban,
  CheckCircle,
} from "lucide-react";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  Skeleton,
} from "@/components/ui";
import type { User } from "@/types";
import UserActionDialog, { type PendingUserAction } from "./UserActionDialog";

interface UserTableProps {
  users: User[];
  isLoading?: boolean;
  onUpdateStatus: (userId: string, status: string) => void;
  onUpdateRole: (userId: string, role: string) => void;
  // Admins only; the table hides the actions for everyone else.
  onUpdateLimit?: (userId: string, limit: string) => void;
  canManage?: boolean;
}

function getRoleBadgeVariant(role: User["role"]) {
  switch (role) {
    case "admin":
      return "danger";
    case "reviewer":
      return "warning";
    case "analyst":
      return "info";
    default:
      return "default";
  }
}

function getStatusBadgeVariant(status: User["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

export default function UserTable({
  users,
  isLoading = false,
  onUpdateStatus,
  onUpdateRole,
  onUpdateLimit,
  canManage = true,
}: UserTableProps) {
  const [pending, setPending] = useState<PendingUserAction | null>(null);
  const done = () => setPending(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg"
          >
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">No users found</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Users"
    >
      <UserActionDialog
        action={pending}
        onCancel={done}
        onRole={(id, role) => {
          onUpdateRole(id, role);
          done();
        }}
        onStatus={(id, status) => {
          onUpdateStatus(id, status);
          done();
        }}
        onLimit={(id, limit) => {
          onUpdateLimit?.(id, limit);
          done();
        }}
      />
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              User
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Role
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Status
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Joined
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const initials =
              `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

            return (
              <tr
                key={user.id}
                className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={getRoleBadgeVariant(user.role)}
                    className="capitalize"
                  >
                    {user.role}
                  </Badge>
                  {user.role === "reviewer" && user.decision_limit != null && (
                    <span className="ml-2 text-xs text-neutral-500">
                      up to {formatMoney(user.decision_limit)}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Badge
                    variant={getStatusBadgeVariant(user.status)}
                    className="capitalize"
                  >
                    {user.status}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {dayjs(user.created_at).format("MMM DD, YYYY")}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setPending({ kind: "role", user, role: "customer" })
                          }
                        >
                          <UserIcon className="mr-2 h-4 w-4" />
                          Set as Customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setPending({ kind: "role", user, role: "analyst" })
                          }
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Set as Analyst
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setPending({ kind: "role", user, role: "reviewer" })
                          }
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Set as Reviewer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setPending({ kind: "role", user, role: "admin" })
                          }
                        >
                          <Shield className="mr-2 h-4 w-4 text-danger-500" />
                          Set as Admin
                        </DropdownMenuItem>
                        {user.role === "reviewer" && onUpdateLimit && (
                          <DropdownMenuItem
                            onClick={() => setPending({ kind: "limit", user })}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Set decision limit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {user.status === "active" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              setPending({
                                kind: "status",
                                user,
                                status: "suspended",
                              })
                            }
                            className="text-danger-600 dark:text-danger-400"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              setPending({
                                kind: "status",
                                user,
                                status: "active",
                              })
                            }
                            className="text-success-600 dark:text-success-400"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Activate User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
