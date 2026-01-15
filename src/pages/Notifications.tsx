import { useState } from "react";
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
  Sparkles,
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
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StudentLayout } from "@/components/student/StudentLayout";

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
    acceptInvitation,
    declineInvitation,
  } = useNotifications();

  const [showPreferences, setShowPreferences] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [processingInvitations, setProcessingInvitations] = useState<Set<string>>(new Set());

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
    
    setProcessingInvitations(prev => new Set(prev).add(notification.id));
    const success = await acceptInvitation(notification.related_id, notification.id);
    setProcessingInvitations(prev => {
      const newSet = new Set(prev);
      newSet.delete(notification.id);
      return newSet;
    });
    
    if (success) {
      toast.success("Invitation accepted! You are now a team member.");
    } else {
      toast.error("Failed to accept invitation");
    }
  };

  const handleDeclineInvitation = async (notification: Notification) => {
    if (!notification.related_id) return;
    
    setProcessingInvitations(prev => new Set(prev).add(notification.id));
    const success = await declineInvitation(notification.related_id, notification.id);
    setProcessingInvitations(prev => {
      const newSet = new Set(prev);
      newSet.delete(notification.id);
      return newSet;
    });
    
    if (success) {
      toast.success("Invitation declined");
    } else {
      toast.error("Failed to decline invitation");
    }
  };

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

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
          <p className="text-muted-foreground mt-1">
            Stay updated with your activity
          </p>
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
                  <p className="text-sm text-muted-foreground">
                    Remind before upcoming events
                  </p>
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
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear all
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your notifications will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                const link = getNotificationLink(notification);
                const isTeamInvitation = notification.type === "team_invitation";
                const isProcessing = processingInvitations.has(notification.id);

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

                    <div className="flex-1 min-w-0">
                      {link && !isTeamInvitation ? (
                        <Link
                          to={link}
                          onClick={() => !notification.is_read && markAsRead(notification.id)}
                          className="block"
                        >
                          <p className={cn(
                            "text-sm",
                            !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                          )}>
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
                          <p className={cn(
                            "text-sm",
                            !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                          )}>
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

                      {/* Team invitation action buttons */}
                      {isTeamInvitation && notification.related_id && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptInvitation(notification)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
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
                            disabled={isProcessing}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Action buttons - hide for team invitations since they have their own buttons */}
                    {!isTeamInvitation && (
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "When you receive notifications, they'll appear here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    if (role === "student") {
      return (
        <StudentLayout>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </StudentLayout>
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use StudentLayout for students
  if (role === "student") {
    return <StudentLayout>{content}</StudentLayout>;
  }

  // For clubs, show with simple header
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/club/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              Zot<span className="text-accent">Hub</span>
            </span>
          </Link>
        </div>
      </header>
      {content}
    </div>
  );
}
