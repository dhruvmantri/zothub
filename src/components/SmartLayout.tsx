import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "./Layout";
import { StudentLayout } from "./student/StudentLayout";
import { Loader2 } from "lucide-react";

interface SmartLayoutProps {
  children: ReactNode;
}

/**
 * SmartLayout chooses the appropriate layout based on user role:
 * - Logged-in students → StudentLayout (consistent student navigation)
 * - Logged-in clubs → Layout (club-specific navigation)
 * - Not logged in → Layout (shows login/signup buttons)
 * 
 * IMPORTANT: Waits for auth to fully load before deciding which layout to render.
 */
export function SmartLayout({ children }: SmartLayoutProps) {
  const { user, role, isLoading } = useAuth();

  // Wait for auth state AND role to finish loading before rendering layout
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is a logged-in student, use StudentLayout for consistent nav
  if (user && role === "student") {
    return <StudentLayout>{children}</StudentLayout>;
  }

  // For clubs or non-logged-in users, use the standard Layout
  return <Layout>{children}</Layout>;
}
