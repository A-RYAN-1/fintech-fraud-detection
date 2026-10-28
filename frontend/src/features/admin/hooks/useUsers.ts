import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type UserFilters } from "../api";
import { getErrorMessage } from "@/types";

export const USERS_QUERY_KEY = "admin-users";

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, filters],
    queryFn: () => adminApi.getUsers(filters),
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      adminApi.updateUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast.success("User status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status", {
        description: getErrorMessage(error),
      });
    },
  });
}

export function useUpdateUserLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, limit }: { userId: string; limit: string }) =>
      adminApi.updateUserLimit(userId, limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast.success("Decision limit updated");
    },
    onError: (error) => {
      toast.error("Failed to update limit", {
        description: getErrorMessage(error),
      });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      toast.success("User role updated");
    },
    onError: (error) => {
      toast.error("Failed to update role", {
        description: getErrorMessage(error),
      });
    },
  });
}
