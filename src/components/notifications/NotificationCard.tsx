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
      return role === "student" ? "/activity" : "/applicants";
    case "new_application":
      return "/applicants";
    case "new_message":
      return role === "student" ? "/messages" : "/messages";
    case "event_reminder":
      return notification.related_id ? `/events/${notification.related_id}` : "/events";
    case "new_post": {
      // UX24. A followed club posted something. This is the payoff of the
      // whole Follow feature, and it used to fall through to `null` below and
      // render as dead text: the student was told a club had posted and had no
      // way to reach it. Mark-as-read hangs off the link too, so the unread
      // badge stayed lit as well.
      //
      // ⚠️ The trigger writes ONE type for both surfaces and puts the
      // opportunity/event distinction ONLY in the generated title —
      // `'New ' || v_post_type || ' from ' || club_name`, see
      // supabase/migrations/20260710000300_unify_follow_new_post_notifications.sql.
      // So this reads that title. **If that string changes in the migration,
      // change it here too — nothing will fail loudly, the link will just go
      // quiet again.** The maintainer chose this over splitting the type in a
      // migration (2026-09-21): it needs no deploy step and it fixes the
      // notifications already sent, which a new type would not.
      if (!notification.related_id) return null;
      if (/^New event\b/i.test(notification.title ?? "")) {
        return `/events/${notification.related_id}`;
      }
      if (/^New opportunity\b/i.test(notification.title ?? "")) {
        return `/opportunities/${notification.related_id}`;
      }
      // Deliberately not a guess: sending someone to the wrong surface lands
      // them on a detail page for an id that does not exist there.
      return null;
    }
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
