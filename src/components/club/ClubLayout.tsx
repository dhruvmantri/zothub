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
 * Layout wrapper for club pages.
 * Provides consistent top/bottom navigation with badge counts.
 */
export function ClubLayout({ children }: ClubLayoutProps) {
  const { user } = useAuth();
  const { unreadMessageCount, notificationCount } = useNavigationCounts();
  const [applicationCount, setApplicationCount] = useState(0);

  // Fetch pending application count for the club
  useEffect(() => {
    if (!user) return;

    const fetchApplicationCount = async () => {
      // Get club profile
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubProfile) {
        // Pending applications count
        const { count: appCount } = await supabase
          .from("applications")
          .select("*, opportunities!inner(club_id)", { count: "exact", head: true })
          .eq("opportunities.club_id", clubProfile.id)
          .eq("status", "pending");

        setApplicationCount(appCount || 0);
      }
    };

    fetchApplicationCount();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <ClubTopNav
        unreadMessageCount={unreadMessageCount}
        notificationCount={notificationCount}
        applicationCount={applicationCount}
      />
      
      {/* Main content with padding for fixed header and bottom nav on mobile */}
      <main className="pt-16 pb-20 md:pb-0">
        {children}
      </main>

      <ClubBottomNav />
    </div>
  );
}
