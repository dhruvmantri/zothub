import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * The page a password-reset email links back to (`/reset-password`).
 * ForgotPassword redirects here; the recovery token in the URL is turned into a
 * short-lived session by supabase-js (detectSessionInUrl), so `updateUser` can
 * set the new password. If someone lands here without that session, the update
 * fails and we say so rather than silently doing nothing — this route used to
 * not exist at all, so the link 404'd.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  // Confirm a usable session exists (either already set from the recovery link,
  // or arriving via the PASSWORD_RECOVERY event) so we can warn early if the
  // link was stale or opened directly.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setHasRecoverySession(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setHasRecoverySession(true);
    });
    // Give detectSessionInUrl a moment; if still nothing, mark unavailable.
    const t = setTimeout(() => {
      if (!cancelled) setHasRecoverySession((prev) => (prev === null ? false : prev));
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          updateError.message.toLowerCase().includes("session")
            ? "Your reset link has expired. Please request a new one."
            : updateError.message,
        );
        toast.error("Couldn't reset password");
        return;
      }
      toast.success("Password updated — please log in.");
      navigate("/login", { replace: true });
    } catch {
      setError("An unexpected error occurred.");
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="w-12 h-12 rounded-full bg-accent-wash flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-accent-text" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a new password for your ZotHub account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {hasRecoverySession === false && !error && (
              <Alert variant="destructive">
                <AlertDescription>
                  This reset link is invalid or has expired.{" "}
                  <Link to="/forgot-password" className="font-medium underline">
                    Request a new one
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn(confirm && confirm !== password && "border-destructive")}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>

            <Button variant="outline" className="w-full" asChild>
              <Link to="/login">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to login
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
