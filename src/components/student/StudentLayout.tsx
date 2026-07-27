import { ReactNode } from "react";

import { useNavigationCounts } from "@/hooks/useNavigationCounts";
import { StudentTopNav } from "./StudentTopNav";
import { StudentBottomNav } from "./StudentBottomNav";

interface StudentLayoutProps {
  children: ReactNode;
}

/**
 * Layout wrapper for student pages. Provides the top bar and the mobile tab
 * bar with live counts.
 */
export function StudentLayout({ children }: StudentLayoutProps) {
  const { unreadMessageCount, notificationCount } = useNavigationCounts();

  return (
    <div className="min-h-screen bg-surface-2">
      <StudentTopNav
        unreadMessageCount={unreadMessageCount}
        notificationCount={notificationCount}
      />

      {/* Clears the fixed header, and the tab bar on mobile. */}
      <main className="pb-24 pt-[60px] md:pb-0">{children}</main>

      <StudentBottomNav unreadMessageCount={unreadMessageCount} />
    </div>
  );
}
