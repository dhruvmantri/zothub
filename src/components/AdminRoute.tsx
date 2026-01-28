import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute protects routes that should only be accessible to admin users.
 * Uses the role from AuthContext which is fetched from the user_roles table.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== "admin") {
    // Redirect non-admins to their appropriate dashboard
    if (role === "club") {
      return <Navigate to="/club/dashboard" replace />;
    } else if (role === "student") {
      return <Navigate to="/student/dashboard" replace />;
    }
    // If no role, redirect to landing
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
