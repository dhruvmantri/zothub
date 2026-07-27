import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Loader2,
  Inbox,
  FileText,
  MessageSquare,
  Calendar,
  Clock,
  X,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useTeamInvitations } from "@/hooks/useTeamInvitations";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import {
  NotificationPreferencesDialog,
  TeamInvitationCard,
  NotificationCard,
} from "@/components/notifications";

type InvitationStatus = "pending" | "active" | "declined" | null;

export default function Notifications() {
  const { user, role } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    preferences,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    updatePreferences,
    refetch,
  } = useNotifications();

  const {
    acceptInvitation,
    declineInvitation,
    checkInvitationStatus,
    isProcessing,
  } = useTeamInvitations();

  const [showPreferences, setShowPreferences] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [processingInvitations, setProcessingInvitations] = useState<Set<string>>(new Set());
  const [invitationStatuses, setInvitationStatuses] = useState<Record<string, InvitationStatus>>({});

  // Fetch invitation statuses for team_invitation notifications.
  // Only runs when there are actual team invitations — previously this ran on
  // every notification set (and re-ran on every render because
  // checkInvitationStatus was an unstable reference), setting state each time
  // and thrashing the page into an update loop that blocked the UI.
  useEffect(() => {
    const teamInvitations = notifications.filter(
      (n) => n.type === "team_invitation" && n.related_id
    );

    if (teamInvitations.length === 0) return;

    let cancelled = false;
    const fetchStatuses = async () => {
      const statuses: Record<string, InvitationStatus> = {};
      await Promise.all(
        teamInvitations.map(async (n) => {
          if (n.related_id) {
            statuses[n.id] = await checkInvitationStatus(n.related_id);
          }
        })
      );
      if (!cancelled) setInvitationStatuses(statuses);
    };

    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [notifications, checkInvitationStatus]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application_update":
        return <FileText className="w-5 h-5 text-accent-text" />;
      case "new_message":
        return <MessageSquare className="w-5 h-5 text-accent-text" />;
      case "event_reminder":
        return <Calendar className="w-5 h-5 text-ok" />;
      case "deadline_reminder":
        return <Clock className="w-5 h-5 text-warn" />;
      case "team_invitation":
        return <Users className="w-5 h-5 text-ink-2" />;
      default:
        return <Bell className="w-5 h-5 text-ink-3" />;
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    await markAsRead(notification.id);
    toast.success("Marked as read");
  };

  const handleMarkAsUnread = async (notification: Notification) => {
    await markAsUnread(notification.id);
    toast.success("Marked as unread");
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
    toast.success("Notification deleted");
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success("All notifications marked as read");
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    toast.success("All notifications cleared");
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    await updatePreferences(newPreferences);
    toast.success("Preferences updated");
  };

  const handleAcceptInvitation = async (notification: Notification) => {
    if (!notification.related_id) return;

    setProcessingInvitations((prev) => new Set(prev).add(notification.id));
    const success = await acceptInvitation(notification.related_id, notification.id);
    setProcessingInvitations((prev) => {
      const newSet = new Set(prev);
      newSet.delete(notification.id);
      return newSet;
    });

    if (success) {
      setInvitationStatuses((prev) => ({ ...prev, [notification.id]: "active" }));
      refetch();
    }
  };

  const handleDeclineInvitation = async (notification: Notification) => {
    if (!notification.related_id) return;

    setProcessingInvitations((prev) => new Set(prev).add(notification.id));
    const success = await declineInvitation(notification.related_id, notification.id);
    setProcessingInvitations((prev) => {
      const newSet = new Set(prev);
      newSet.delete(notification.id);
      return newSet;
    });

    if (success) {
      setInvitationStatuses((prev) => ({ ...prev, [notification.id]: "declined" }));
      refetch();
    }
  };

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const content = (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink flex items-center gap-2">
            <Bell className="w-6 h-6 text-accent-text" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="accent" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </h1>
          <p className="text-ink-2 mt-1">Stay updated with your activity</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowPreferences(true)}>
          <Settings className="w-4 h-4 mr-2" />
          Preferences
        </Button>
      </div>

      <NotificationPreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        preferences={preferences}
        onPreferenceChange={handlePreferenceChange}
      />

      <Card>
        <div className="p-4 border-b border-line">
          <div className="flex items-center justify-between">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">
                  Unread
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 px-1.5 py-0">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear all
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your notifications will be permanently
                        deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Clear all
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-line">
              {filteredNotifications.map((notification) => {
                const isTeamInvitation = notification.type === "team_invitation";
                const invitationStatus = invitationStatuses[notification.id];
                const showActionButtons = !isTeamInvitation ||
                  (invitationStatus !== "pending" && invitationStatus !== null);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-4 p-4 hover:bg-surface-2 transition-colors group",
                      // Unread → an accent left-bar over a near-base surface, not a
                      // full accent-wash tint: the wash drops meta text (ink-3) to
                      // 4.49:1 in dark (the "passes on base, fails on a wash" trap).
                      !notification.is_read && "bg-surface-2 shadow-[inset_3px_0_0_hsl(var(--accent))]"
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {isTeamInvitation ? (
                      <TeamInvitationCard
                        notification={notification}
                        status={invitationStatus}
                        isProcessing={processingInvitations.has(notification.id) || isProcessing}
                        onAccept={() => handleAcceptInvitation(notification)}
                        onDecline={() => handleDeclineInvitation(notification)}
                      />
                    ) : (
                      <NotificationCard
                        notification={notification}
                        role={role}
                        onMarkAsRead={() => markAsRead(notification.id)}
                      />
                    )}

                    {/* Action buttons - show for non-team invitations OR responded team invitations */}
                    {showActionButtons && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {notification.is_read ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleMarkAsUnread(notification)}
                            aria-label="Mark as unread"
                          >
                            <Bell className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleMarkAsRead(notification)}
                            aria-label="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-bad hover:bg-bad-wash hover:text-bad"
                          onClick={() => handleDelete(notification.id)}
                          aria-label="Delete notification"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Inbox className="w-12 h-12 mx-auto text-ink-3 mb-4" />
              <p className="text-ink-2">
                {filter === "unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </p>
              <p className="text-sm text-ink-3 mt-1">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "We'll notify you when something happens"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <RoleBasedLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-ink-3" />
        </div>
      </RoleBasedLayout>
    );
  }

  // Render inside the role-aware layout so both students and clubs keep their
  // normal top/bottom navigation (logo, dashboard, back) on this page.
  return <RoleBasedLayout>{content}</RoleBasedLayout>;
}
