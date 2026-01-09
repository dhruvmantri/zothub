import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StudentTopNav } from "./StudentTopNav";
import { StudentBottomNav } from "./StudentBottomNav";

interface StudentLayoutProps {
  children: ReactNode;
}

export function StudentLayout({ children }: StudentLayoutProps) {
  const { user } = useAuth();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch initial counts
    fetchCounts();

    // Subscribe to real-time updates for messages
    const messagesChannel = supabase
      .channel("student-layout-messages")
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
      .channel("student-layout-notifications")
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
  }, [user]);

  const fetchCounts = async () => {
    await Promise.all([fetchMessageCount(), fetchNotificationCount()]);
  };

  const fetchMessageCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    setUnreadMessageCount(count || 0);
  };

  const fetchNotificationCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotificationCount(count || 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav
        unreadMessageCount={unreadMessageCount}
        notificationCount={notificationCount}
      />
      
      {/* Main content with padding for bottom nav on mobile */}
      <main className="pb-20 md:pb-0">
        {children}
      </main>

      <StudentBottomNav />
    </div>
  );
}
