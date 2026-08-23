import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWaitlist } from "@/hooks/useWaitlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, Mail, LogOut } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";

export default function WaitlistRejected() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { entry, isLoading } = useWaitlist();

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
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-bad-wash flex items-center justify-center">
            <XCircle className="h-8 w-8 text-bad" />
          </div>
          <CardTitle className="text-2xl">Application Not Approved</CardTitle>
          <CardDescription>
            Unfortunately, your signup request was not approved at this time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-surface-2 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-ink-2">
              <Mail className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
          </div>

          {entry?.rejection_reason && (
            <div className="bg-bad-wash border border-bad/30 rounded-lg p-4">
              <p className="text-sm font-medium text-bad mb-1">Reason:</p>
              <p className="text-sm text-ink-2">{entry.rejection_reason}</p>
            </div>
          )}

          <div className="space-y-2 text-center text-sm text-ink-2">
            <p>
              If you believe this was a mistake,{" "}
              <Link
                to="/help"
                className="text-accent-text underline underline-offset-2 hover:no-underline"
              >
                get in touch
              </Link>
              {" "}— a person reads every message.
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
