import { apiClient } from "@/lib";
import type { ApiResponse, User, PaginationMeta } from "@/types";

export interface UsersListResponse {
  users: User[];
  pagination: PaginationMeta;
}

export interface AuditLog {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  description: string;
  actor: string | null;
  actor_role: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  audit_logs: AuditLog[];
  pagination: PaginationMeta;
}

export interface UserFilters {
  page?: number;
  per_page?: number;
  role?: string;
  status?: string;
  search?: string;
}

export interface AuditLogFilters {
  page?: number;
  per_page?: number;
  event_type?: string;
  entity_type?: string;
  actor_role?: string;
}

export const adminApi = {
  // Users
  getUsers: async (filters: UserFilters = {}): Promise<UsersListResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page)
      params.append("per_page", filters.per_page.toString());
    if (filters.role) params.append("role", filters.role);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);

    const response = await apiClient.get<ApiResponse<UsersListResponse>>(
      `/admin/users?${params.toString()}`,
    );
    return response.data.data;
  },

  updateUserStatus: async (userId: string, status: string): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(
      `/admin/users/${userId}/status`,
      { status },
    );
    return response.data.data;
  },

  updateUserRole: async (userId: string, role: string): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(
      `/admin/users/${userId}/role`,
      { role },
    );
    return response.data.data;
  },

  updateUserLimit: async (
    userId: string,
    decisionLimit: string,
  ): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(
      `/admin/users/${userId}/limit`,
      { decision_limit: decisionLimit },
    );
    return response.data.data;
  },

  // Audit Logs
  getAuditLogs: async (
    filters: AuditLogFilters = {},
  ): Promise<AuditLogsResponse> => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page)
      params.append("per_page", filters.per_page.toString());
    if (filters.event_type) params.append("event_type", filters.event_type);
    if (filters.entity_type) params.append("entity_type", filters.entity_type);
    if (filters.actor_role) params.append("actor_role", filters.actor_role);

    const response = await apiClient.get<ApiResponse<AuditLogsResponse>>(
      `/admin/audit_logs?${params.toString()}`,
    );
    return response.data.data;
  },
};
