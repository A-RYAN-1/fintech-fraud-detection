export type NotificationType =
  "transaction" | "security" | "system" | "info" | "support";
export type NotificationPriority = "low" | "medium" | "high";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  created_at: string;
  data?: {
    transaction_id?: string;
    risk_score?: number;
    status?: string;
    amount?: number;
  };
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastFetched: string | null;
  isLoading: boolean;
}
