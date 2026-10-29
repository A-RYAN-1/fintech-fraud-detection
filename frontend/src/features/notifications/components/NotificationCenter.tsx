import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, RefreshCw, Loader2 } from "lucide-react";
import {
  Button,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useAuth } from "@/features/auth/hooks";
import { useNotifications } from "../hooks";
import NotificationItem from "./NotificationItem";
import type { Notification } from "../types";

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const paymentsPath = user?.role === "customer" ? "/history" : "/admin/review";
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    fetchNotifications,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (notification.data?.transaction_id) {
      navigate(paymentsPath);
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger-500 text-[10px] font-medium text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notifications {unreadCount > 0 && `(${unreadCount} unread)`}</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Notifications
          </h3>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={fetchNotifications}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            {unreadCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={markAllAsRead}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark all as read</TooltipContent>
              </Tooltip>
            )}
            {notifications.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={clearAll}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-96">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                No notifications
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onRemove={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => navigate(paymentsPath)}
              >
                {user?.role === "customer"
                  ? "Open your payment history"
                  : "Open the Review Queue"}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
