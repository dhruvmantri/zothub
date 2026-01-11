import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NavigationCounts {
  unreadMessageCount: number;
  notificationCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Centralized hook for fetching unread message and notification counts.
 * Includes real-time subscriptions for automatic updates.
 * 
 * Use this hook in layout components instead of duplicating count logic.
 */
export function useNavigationCounts(): NavigationCounts {
  const { user } = useAuth();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessageCount = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    setUnreadMessageCount(count || 0);
  }, [user]);

  const fetchNotificationCount = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotificationCount(count || 0);
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    await Promise.all([fetchMessageCount(), fetchNotificationCount()]);
    setIsLoading(false);
  }, [user, fetchMessageCount, fetchNotificationCount]);

  useEffect(() => {
    if (!user) {
      setUnreadMessageCount(0);
      setNotificationCount(0);
      setIsLoading(false);
      return;
    }

    // Fetch initial counts
    fetchCounts();

    // Subscribe to real-time updates for messages
    const messagesChannel = supabase
      .channel("nav-counts-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchMessageCount();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for notifications
    const notificationsChannel = supabase
      .channel("nav-counts-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, fetchCounts, fetchMessageCount, fetchNotificationCount]);

  return {
    unreadMessageCount,
    notificationCount,
    isLoading,
    refetch: fetchCounts,
  };
}
