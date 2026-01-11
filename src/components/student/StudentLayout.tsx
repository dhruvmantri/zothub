import { ReactNode } from "react";
import { useNavigationCounts } from "@/hooks/useNavigationCounts";
import { StudentTopNav } from "./StudentTopNav";
import { StudentBottomNav } from "./StudentBottomNav";

interface StudentLayoutProps {
  children: ReactNode;
}

/**
 * Layout wrapper for student pages.
 * Provides consistent top/bottom navigation with badge counts.
 */
export function StudentLayout({ children }: StudentLayoutProps) {
  const { unreadMessageCount, notificationCount } = useNavigationCounts();

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav
        unreadMessageCount={unreadMessageCount}
        notificationCount={notificationCount}
      />
      
      {/* Main content with padding for fixed header and bottom nav on mobile */}
      <main className="pt-16 pb-20 md:pb-0">
        {children}
      </main>

      <StudentBottomNav />
    </div>
  );
}
