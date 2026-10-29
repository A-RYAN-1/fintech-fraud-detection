import { X, ShieldAlert, Bell, Info, LifeBuoy } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Button } from "@/components/ui";
import { cn } from "@/utils";
import type { Notification } from "../types";

dayjs.extend(relativeTime);

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

const iconMap = {
  transaction: Bell,
  security: ShieldAlert,
  system: Info,
  info: Info,
  support: LifeBuoy,
};

const priorityStyles = {
  high: "border-l-danger-500",
  medium: "border-l-warning-500",
  low: "border-l-primary-500",
};

export default function NotificationItem({
  notification,
  onRead,
  onRemove,
  onClick,
}: NotificationItemProps) {
  const Icon = iconMap[notification.type];

  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    onClick?.(notification);
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3 border-l-4 rounded-r-lg transition-colors cursor-pointer",
        priorityStyles[notification.priority],
        notification.read
          ? "bg-neutral-50 dark:bg-neutral-900"
          : "bg-white dark:bg-neutral-800 shadow-sm",
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "shrink-0 h-9 w-9 rounded-full flex items-center justify-center",
          notification.priority === "high"
            ? "bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400"
            : notification.priority === "medium"
              ? "bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400"
              : "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              notification.read
                ? "text-neutral-600 dark:text-neutral-400"
                : "text-neutral-900 dark:text-neutral-100",
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-primary-500" />
          )}
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          {dayjs(notification.created_at).fromNow()}
        </p>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notification.id);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
