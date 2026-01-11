import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "./Layout";
import { StudentLayout } from "./student/StudentLayout";

interface SmartLayoutProps {
  children: ReactNode;
}

/**
 * SmartLayout chooses the appropriate layout based on user role:
 * - Logged-in students → StudentLayout (consistent student navigation)
 * - Logged-in clubs → Layout (club-specific navigation)
 * - Not logged in → Layout (shows login/signup buttons)
 */
export function SmartLayout({ children }: SmartLayoutProps) {
  const { user, role } = useAuth();

  // If user is a logged-in student, use StudentLayout for consistent nav
  if (user && role === "student") {
    return <StudentLayout>{children}</StudentLayout>;
  }

  // For clubs or non-logged-in users, use the standard Layout
  return <Layout>{children}</Layout>;
}
