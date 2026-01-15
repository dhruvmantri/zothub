import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  application_updates: boolean;
  event_reminders: boolean;
  new_messages: boolean;
  deadline_reminders: boolean;
  team_invitations: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    application_updates: true,
    event_reminders: true,
    new_messages: true,
    deadline_reminders: true,
    team_invitations: true,
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          application_updates: data.application_updates,
          event_reminders: data.event_reminders,
          new_messages: data.new_messages,
          deadline_reminders: data.deadline_reminders,
          team_invitations: data.team_invitations ?? true,
        });
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();

      // Subscribe to real-time notifications
      const channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchNotifications, fetchPreferences]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: false })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: false } : n
        )
      );
      setUnreadCount((prev) => prev + 1);
    } catch (error) {
      console.error("Error marking notification as unread:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const notification = notifications.find((n) => n.id === notificationId);
      
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const updatePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPreferences,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setPreferences(newPreferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  // Accept a team invitation
  const acceptInvitation = async (teamMemberId: string, notificationId: string) => {
    if (!user) return false;

    try {
      // Update team member status
      const { error: updateError } = await supabase
        .from("club_team_members")
        .update({ 
          status: "active", 
          joined_at: new Date().toISOString(),
          user_id: user.id 
        })
        .eq("id", teamMemberId);

      if (updateError) throw updateError;

      // Delete the notification
      await deleteNotification(notificationId);

      return true;
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return false;
    }
  };

  // Decline a team invitation
  const declineInvitation = async (teamMemberId: string, notificationId: string) => {
    if (!user) return false;

    try {
      // Delete the team member record
      const { error: deleteError } = await supabase
        .from("club_team_members")
        .delete()
        .eq("id", teamMemberId);

      if (deleteError) throw deleteError;

      // Delete the notification
      await deleteNotification(notificationId);

      return true;
    } catch (error) {
      console.error("Error declining invitation:", error);
      return false;
    }
  };

  return {
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
    refetch: fetchNotifications,
  };
}
