import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { navCountKeys } from "@/lib/queryKeys";

interface NavigationCounts {
  unreadMessageCount: number;
  notificationCount: number;
  isLoading: boolean;
  refetch: () => void;
}

async function fetchUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(`Failed to load message count: ${error.message}`);
  return count ?? 0;
}

async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw new Error(`Failed to load notification count: ${error.message}`);
  return count ?? 0;
}

/**
 * Unread message and notification counts for the nav badges.
 *
 * READS ONLY — the realtime subscriptions that keep these fresh live in
 * <NavigationCountsSync />, mounted once in App.tsx. That separation is the
 * actual fix, not the caching: this hook is called from StudentLayout and
 * ClubLayout, which render *inside each page component*, so a route change
 * unmounted them and tore down both websocket channels on EVERY navigation,
 * rebuilding them immediately. Migrating the reads alone would not have touched
 * that.
 *
 * Because the counts are now shared cache entries, both layouts (and the dead
 * DashboardLayout) read the same two entries instead of issuing their own pair.
 */
export function useNavigationCounts(): NavigationCounts {
  const { user } = useAuth();
  const userId = user?.id;

  const messages = useQuery({
    queryKey: navCountKeys.messages(userId ?? "anon"),
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: Boolean(userId),
  });

  const notifications = useQuery({
    queryKey: navCountKeys.notifications(userId ?? "anon"),
    queryFn: () => fetchUnreadNotificationCount(userId!),
    enabled: Boolean(userId),
  });

  return {
    unreadMessageCount: messages.data ?? 0,
    notificationCount: notifications.data ?? 0,
    isLoading: Boolean(userId) && (messages.isPending || notifications.isPending),
    refetch: () => {
      void messages.refetch();
      void notifications.refetch();
    },
  };
}

/**
 * Holds the realtime subscriptions for the nav counts. Renders nothing.
 *
 * MOUNT THIS EXACTLY ONCE, in App.tsx inside <AuthProvider> and outside
 * <Routes>, so it survives navigation.
 *
 * Two things here are deliberate and easy to get wrong:
 *
 * 1. **Channel names carry the user id.** They used to be the global constants
 *    "nav-counts-messages" / "nav-counts-notifications". With `v7_startTransition`
 *    two instances can be mounted at once during a transition; both join the same
 *    Phoenix topic, and the outgoing one's removeChannel can leave the survivor
 *    holding a dead subscription — after which the badges silently stop updating.
 *
 * 2. **The handler invalidates rather than assuming.** With staleTime 60s,
 *    marking data stale does not refetch it; invalidateQueries does refetch an
 *    active observer immediately. And the count is never computed from the
 *    realtime payload: neither table has REPLICA IDENTITY FULL (stated outright
 *    in 20260710000200_add_messages_to_realtime.sql), so `payload.old` carries
 *    only the primary key — there is no way to tell a false->true is_read flip
 *    from a row that was already read.
 *
 * The effect depends on `userId` (a string), not `user`. AuthContext calls
 * setUser(session?.user) on every auth event including TOKEN_REFRESHED, so
 * depending on the object rebuilt both channels on every token refresh.
 */
export function NavigationCountsSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const messagesChannel = supabase
      .channel(`nav-counts-messages:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: navCountKeys.messages(userId) });
        },
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`nav-counts-notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: navCountKeys.notifications(userId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [userId, queryClient]);

  return null;
}
