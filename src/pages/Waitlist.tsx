import { useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWaitlist } from "@/hooks/useWaitlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Mail, LogOut } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function Waitlist() {
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const { status, entry, isLoading, refetch } = useWaitlist();

  // Redirect based on role — but never while the waitlist entry is still
  // pending. A pending user who somehow holds a role (e.g. legacy accounts
  // created before roles were moved to approval time) would otherwise bounce
  // between the dashboard and this page in an infinite loop, because
  // ProtectedRoute sends pending users back here.
  useEffect(() => {
    if (isLoading) return;
    if (status === "rejected") {
      navigate("/waitlist-rejected", { replace: true });
      return;
    }
    if (status === "pending") return;
    if (role === "student") {
      navigate("/student/dashboard", { replace: true });
    } else if (role === "club") {
      navigate("/club/dashboard", { replace: true });
    } else if (role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [role, status, isLoading, navigate]);

  // Poll for status updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Declarative redirect — navigating in the render body logs a React
  // "cannot update a component while rendering" warning and is fragile.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <PageLoader size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-accent-wash flex items-center justify-center">
            <Clock className="h-8 w-8 text-accent-text" />
          </div>
          <CardTitle className="text-2xl">You're on the Waitlist!</CardTitle>
          <CardDescription>
            Thanks for signing up. We're reviewing your application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-surface-2 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <Mail className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            {entry && (
              <div className="text-sm text-ink-2">
                <span className="capitalize">Account type: {entry.role}</span>
              </div>
            )}
            {entry && (
              <div className="text-sm text-ink-2">
                Requested: {new Date(entry.requested_at).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="space-y-2 text-center text-sm text-ink-2">
            <p>
              We manually review all signups to ensure quality and prevent spam.
            </p>
            <p>
              You'll receive an email once your account is approved.
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
