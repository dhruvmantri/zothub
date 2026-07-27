import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/useNotifications";
import type { UserRole } from "@/types";

interface NotificationCardProps {
  notification: Notification;
  role: UserRole | null;
  onMarkAsRead: () => void;
}

function getNotificationLink(notification: Notification, role: UserRole | null): string | null {
  switch (notification.type) {
    case "application_update":
      // Student → Activity (their applications live there); club → the
      // Responses queue. `/club/applications` never existed — it 404'd.
      return role === "student" ? "/student/dashboard" : "/club/dashboard/applications";
    case "new_application":
      return "/club/dashboard/applications";
    case "new_message":
      return role === "student" ? "/student/messages" : "/club/messages";
    case "event_reminder":
      return notification.related_id ? `/events/${notification.related_id}` : "/events";
    default:
      return null;
  }
}

export function NotificationCard({
  notification,
  role,
  onMarkAsRead,
}: NotificationCardProps) {
  const link = getNotificationLink(notification, role);

  const content = (
    <>
      <p
        className={cn(
          "text-sm",
          !notification.is_read ? "font-medium text-ink" : "text-ink-2"
        )}
      >
        {notification.title}
      </p>
      {notification.message && (
        <p className="text-sm text-ink-2 mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      )}
    </>
  );

  return (
    <div className="flex-1 min-w-0">
      {link ? (
        <Link
          to={link}
          onClick={() => !notification.is_read && onMarkAsRead()}
          className="block"
        >
          {content}
        </Link>
      ) : (
        content
      )}
      <p className="font-data text-xs text-ink-3 mt-1">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </p>
    </div>
  );
}
