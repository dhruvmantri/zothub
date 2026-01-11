import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PublicLayout } from "./PublicLayout";
import { StudentLayout } from "./student/StudentLayout";
import { ClubLayout } from "./club/ClubLayout";
import { PageLoader } from "./ui/page-loader";

interface RoleBasedLayoutProps {
  children: ReactNode;
}

/**
 * RoleBasedLayout chooses the appropriate layout based on user role:
 * - Logged-in students → StudentLayout (consistent student navigation)
 * - Logged-in clubs → ClubLayout (club-specific navigation)
 * - Not logged in → PublicLayout (shows login/signup buttons)
 * 
 * IMPORTANT: Waits for auth to fully load before deciding which layout to render.
 */
export function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const { user, role, isLoading } = useAuth();

  // Wait for auth state AND role to finish loading before rendering layout
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PageLoader size="md" />
      </div>
    );
  }

  // If user is a logged-in student, use StudentLayout for consistent nav
  if (user && role === "student") {
    return <StudentLayout>{children}</StudentLayout>;
  }

  // If user is a logged-in club, use ClubLayout for consistent nav
  if (user && role === "club") {
    return <ClubLayout>{children}</ClubLayout>;
  }

  // For non-logged-in users, use the standard PublicLayout
  return <PublicLayout>{children}</PublicLayout>;
}
