import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { StudentLayout } from "@/components/student/StudentLayout";

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

  // Fetch invitation statuses for team_invitation notifications
  useEffect(() => {
    const fetchStatuses = async () => {
      const teamInvitations = notifications.filter(
        (n) => n.type === "team_invitation" && n.related_id
      );

      const statuses: Record<string, InvitationStatus> = {};
      await Promise.all(
        teamInvitations.map(async (n) => {
          if (n.related_id) {
            const status = await checkInvitationStatus(n.related_id);
            statuses[n.id] = status;
          }
        })
      );

      setInvitationStatuses(statuses);
    };

    if (notifications.length > 0) {
      fetchStatuses();
    }
  }, [notifications, checkInvitationStatus]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "application_update":
        return <FileText className="w-5 h-5 text-accent" />;
      case "new_message":
        return <MessageSquare className="w-5 h-5 text-primary" />;
      case "event_reminder":
        return <Calendar className="w-5 h-5 text-emerald-500" />;
      case "deadline_reminder":
        return <Clock className="w-5 h-5 text-amber-500" />;
      case "team_invitation":
        return <Users className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case "application_update":
        return role === "student" ? "/student/dashboard" : "/club/applications";
      case "new_message":
        return role === "student" ? "/student/messages" : "/club/messages";
      case "event_reminder":
        return notification.related_id ? `/events/${notification.related_id}` : "/events";
      default:
        return null;
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
      // Update local status immediately
      setInvitationStatuses((prev) => ({ ...prev, [notification.id]: "active" }));
      // Refetch notifications to get updated message
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
      // Update local status immediately
      setInvitationStatuses((prev) => ({ ...prev, [notification.id]: "declined" }));
      // Refetch notifications to get updated message
      refetch();
    }
  };

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  // Render team invitation notification
  const renderTeamInvitation = (notification: Notification) => {
    const status = invitationStatuses[notification.id];
    const isProcessingThis = processingInvitations.has(notification.id);
    const isPending = status === "pending" || status === null;
    const isAccepted = status === "active";
    const isDeclined = status === "declined";

    return (
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm",
            !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>

        {/* Show Accept/Decline buttons only for pending invitations */}
        {isPending && notification.related_id && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => handleAcceptInvitation(notification)}
              disabled={isProcessingThis || isProcessing}
            >
              {isProcessingThis ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeclineInvitation(notification)}
              disabled={isProcessingThis || isProcessing}
            >
              <X className="w-4 h-4 mr-1" />
              Decline
            </Button>
          </div>
        )}

        {/* Show status badges for responded invitations */}
        {isAccepted && (
          <div className="mt-2">
            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
              <Check className="w-3 h-3 mr-1" />
              Accepted
            </Badge>
          </div>
        )}
        {isDeclined && (
          <div className="mt-2">
            <Badge variant="secondary">
              <X className="w-3 h-3 mr-1" />
              Declined
            </Badge>
          </div>
        )}
      </div>
    );
  };

  // Render standard notification
  const renderStandardNotification = (notification: Notification) => {
    const link = getNotificationLink(notification);

    return (
      <div className="flex-1 min-w-0">
        {link ? (
          <Link
            to={link}
            onClick={() => !notification.is_read && markAsRead(notification.id)}
            className="block"
          >
            <p
              className={cn(
                "text-sm",
                !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            )}
          </Link>
        ) : (
          <>
            <p
              className={cn(
                "text-sm",
                !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    );
  };

  // Wrap content in StudentLayout for students, otherwise show standalone
  const content = (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-accent" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="accent" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Stay updated with your activity</p>
        </div>

        <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Preferences
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notification Preferences</DialogTitle>
              <DialogDescription>
                Choose which notifications you want to receive.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Application Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when application status changes
                  </p>
                </div>
                <Switch
                  checked={preferences.application_updates}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("application_updates", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Event Reminders</Label>
                  <p className="text-sm text-muted-foreground">Remind before upcoming events</p>
                </div>
                <Switch
                  checked={preferences.event_reminders}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("event_reminders", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when you receive a message
                  </p>
                </div>
                <Switch
                  checked={preferences.new_messages}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("new_messages", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Deadline Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Remind about approaching deadlines
                  </p>
                </div>
                <Switch
                  checked={preferences.deadline_reminders}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("deadline_reminders", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Team Invitations</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when invited to join a club team
                  </p>
                </div>
                <Switch
                  checked={preferences.team_invitations}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("team_invitations", checked)
                  }
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="p-4 border-b border-border">
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
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => {
                const isTeamInvitation = notification.type === "team_invitation";
                const invitationStatus = invitationStatuses[notification.id];
                const showActionButtons = !isTeamInvitation || 
                  (invitationStatus !== "pending" && invitationStatus !== null);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-4 p-4 hover:bg-secondary/50 transition-colors group",
                      !notification.is_read && "bg-accent/5"
                    )}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {isTeamInvitation
                      ? renderTeamInvitation(notification)
                      : renderStandardNotification(notification)}

                    {/* Action buttons - show for non-team invitations OR responded team invitations */}
                    {showActionButtons && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notification.is_read ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMarkAsUnread(notification)}
                            title="Mark as unread"
                          >
                            <Bell className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMarkAsRead(notification)}
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(notification.id)}
                          title="Delete"
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
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {filter === "unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render with appropriate layout based on user role
  if (role === "student") {
    return <StudentLayout>{content}</StudentLayout>;
  }

  // For clubs, show a simple header
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link to="/club/home" className="font-display font-bold text-xl text-primary">
            ZotHub
          </Link>
        </div>
      </header>
      {content}
    </div>
  );
}
