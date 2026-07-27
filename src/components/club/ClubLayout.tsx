import { ReactNode, useState, useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useNavigationCounts } from "@/hooks/useNavigationCounts";
import { supabase } from "@/integrations/supabase/client";
import { ClubTopNav } from "./ClubTopNav";
import { ClubBottomNav } from "./ClubBottomNav";

interface ClubLayoutProps {
  children: ReactNode;
}

/**
 * Layout wrapper for club pages. The Responses count is pending applications
 * plus pending RSVPs — the two things actually waiting on the club — because
 * Responses is one queue over both (Structure §5).
 */
export function ClubLayout({ children }: ClubLayoutProps) {
  const { user } = useAuth();
  const { unreadMessageCount, notificationCount } = useNavigationCounts();
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchResponseCount = async () => {
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clubProfile || cancelled) return;

      const [{ count: appCount }, { count: rsvpCount }] = await Promise.all([
        supabase
          .from("applications")
          .select("*, opportunities!inner(club_id)", { count: "exact", head: true })
          .eq("opportunities.club_id", clubProfile.id)
          .eq("status", "pending"),
        supabase
          .from("rsvps")
          .select("*, events!inner(club_id)", { count: "exact", head: true })
          .eq("events.club_id", clubProfile.id)
          .eq("status", "pending"),
      ]);

      if (!cancelled) setResponseCount((appCount || 0) + (rsvpCount || 0));
    };

    fetchResponseCount();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-surface-2">
      <ClubTopNav
        unreadMessageCount={unreadMessageCount}
        notificationCount={notificationCount}
        applicationCount={responseCount}
      />

      <main className="pb-24 pt-[60px] md:pb-0">{children}</main>

      <ClubBottomNav unreadMessageCount={unreadMessageCount} applicationCount={responseCount} />
    </div>
  );
}
