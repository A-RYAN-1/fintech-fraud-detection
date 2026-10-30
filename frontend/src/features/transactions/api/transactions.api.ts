import { apiClient } from "@/lib";
import type {
  ApiResponse,
  Transaction,
  TransactionsListResponse,
  CreateTransactionPayload,
  FeedbackPayload,
  FraudEvaluation,
} from "@/types";

export interface TransactionFilters {
  page?: number;
  // Keyset paging, newest first: "" for the first page, then next_cursor of the previous one.
  cursor?: string;
  per_page?: number;
  search?: string;
  status?: string;
  payment_method?: string;
  start_date?: string;
  end_date?: string;
  min_risk_score?: number;
  max_risk_score?: number;
  min_amount?: number;
  max_amount?: number;
  sort_by?: "created_at" | "amount" | "risk_score";
  sort_order?: "asc" | "desc";
}

export const transactionsApi = {
  getTransactions: async (
    filters: TransactionFilters = {},
  ): Promise<TransactionsListResponse> => {
    const params = new URLSearchParams();

    if (filters.page) params.append("page", filters.page.toString());
    if (filters.cursor !== undefined) params.append("cursor", filters.cursor);
    if (filters.per_page)
      params.append("per_page", filters.per_page.toString());
    if (filters.search) params.append("search", filters.search);
    if (filters.status) params.append("status", filters.status);
    if (filters.payment_method)
      params.append("payment_method", filters.payment_method);
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);
    if (filters.min_risk_score !== undefined)
      params.append("min_risk_score", filters.min_risk_score.toString());
    if (filters.max_risk_score !== undefined)
      params.append("max_risk_score", filters.max_risk_score.toString());
    if (filters.min_amount !== undefined)
      params.append("min_amount", filters.min_amount.toString());
    if (filters.max_amount !== undefined)
      params.append("max_amount", filters.max_amount.toString());
    if (filters.sort_by) params.append("sort_by", filters.sort_by);
    if (filters.sort_order) params.append("sort_order", filters.sort_order);

    const response = await apiClient.get<ApiResponse<TransactionsListResponse>>(
      `/transactions?${params.toString()}`,
    );
    return response.data.data;
  },

  createTransaction: async (
    payload: CreateTransactionPayload,
  ): Promise<Transaction> => {
    const response = await apiClient.post<ApiResponse<Transaction>>(
      "/transactions",
      {
        transaction: payload,
      },
    );
    return response.data.data;
  },

  submitFeedback: async (
    transactionId: string,
    payload: FeedbackPayload,
  ): Promise<FraudEvaluation> => {
    const response = await apiClient.post<ApiResponse<FraudEvaluation>>(
      `/transactions/${transactionId}/feedback`,
      { feedback: payload },
    );
    return response.data.data;
  },
};
