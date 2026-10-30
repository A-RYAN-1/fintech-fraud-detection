import { apiClient } from "@/lib";
import { idempotencyHeaders } from "@/utils/idempotency";
import type { ApiResponse, PaginationMeta } from "@/types";

export type IncidentStatus = "open" | "reported" | "dismissed";
export type IncidentKind = "paypal_error" | "job_failed" | "analyst";

export interface Incident {
  id: number;
  kind: IncidentKind;
  title: string;
  status: IncidentStatus;
  occurrences: number;
  recurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  sample: Record<string, string | number | null>;
  detail: string | null;
  ai_note: string | null;
  draft: { title: string; body: string; new_issue_url: string };
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  issue_url: string | null;
}

export interface IncidentsResponse {
  incidents: Incident[];
  meta: PaginationMeta;
  // One report of everything open, ready to paste.
  digest: string;
  open_count: number;
}

export const incidentsApi = {
  list: async (status: IncidentStatus | "all"): Promise<IncidentsResponse> => {
    const response = await apiClient.get<ApiResponse<IncidentsResponse>>(
      `/admin/incidents?status=${status}&per_page=50`,
    );
    return response.data.data;
  },

  scan: async (): Promise<{ observed: number; open_count: number }> => {
    const response = await apiClient.post<
      ApiResponse<{ observed: number; open_count: number }>
    >("/admin/incidents/scan");
    return response.data.data;
  },

  decide: async (
    id: number,
    decision: "approve" | "dismiss",
    note: string,
    issueUrl: string,
    idempotencyKey: string,
  ): Promise<Incident> => {
    const response = await apiClient.post<ApiResponse<Incident>>(
      `/admin/incidents/${id}/${decision}`,
      { note, issue_url: issueUrl || undefined },
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },

  suggest: async (id: number, idempotencyKey: string): Promise<Incident> => {
    const response = await apiClient.post<ApiResponse<Incident>>(
      `/admin/incidents/${id}/suggest`,
      undefined,
      { headers: idempotencyHeaders(idempotencyKey) },
    );
    return response.data.data;
  },
};
