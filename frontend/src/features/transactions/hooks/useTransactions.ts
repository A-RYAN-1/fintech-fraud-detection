import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { transactionsApi, type TransactionFilters } from "../api";

export const TRANSACTIONS_QUERY_KEY = "transactions";

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, filters],
    queryFn: () => transactionsApi.getTransactions(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// The history list: newest first, "Show older" asks for the next cursor. Filters change the key, so they start over.
export function useInfiniteTransactions(
  filters: Omit<TransactionFilters, "page" | "cursor"> = {},
) {
  return useInfiniteQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, "keyset", filters],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      transactionsApi.getTransactions({ ...filters, cursor: pageParam }),
    getNextPageParam: (last) =>
      "next_cursor" in last.pagination
        ? (last.pagination.next_cursor ?? undefined)
        : undefined,
    staleTime: 1000 * 60 * 2,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, "dashboard-stats"],
    queryFn: () => transactionsApi.getTransactions({ per_page: 10 }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
