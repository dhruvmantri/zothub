import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWaitlist } from "@/hooks/useWaitlist";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("student" | "club" | "admin")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();
  const { status: waitlistStatus, isLoading: waitlistLoading } = useWaitlist();
  const location = useLocation();

  if (isLoading || waitlistLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is on waitlist (pending), redirect to waitlist page
  if (waitlistStatus === "pending") {
    return <Navigate to="/waitlist" replace />;
  }

  // If user was rejected, redirect to rejected page
  if (waitlistStatus === "rejected") {
    return <Navigate to="/waitlist-rejected" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on role
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    } else if (role === "club") {
      return <Navigate to="/club/dashboard" replace />;
    } else {
      return <Navigate to="/student/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
