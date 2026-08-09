import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Change-password card for the student and club profile-edit pages.
 *
 * The current-password field is UX friction — it prevents an accidental change
 * and lightly deters a walk-up on an unlocked screen. It is NOT, by itself, a
 * defense against a hijacked session: an attacker who already holds the session
 * token could call auth.updateUser directly, bypassing this form. The real
 * server-side control is GoTrue's `secure_password_change` (Auth settings), which
 * requires recent reauthentication for a password change; enable it server-side to
 * make this guarantee real. See docs/design/mb5-claim-flow.md §Change password.
 */
export function ChangePasswordCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (!user?.email) {
      setError("Couldn't determine your account email. Please re-log in and try again.");
      return;
    }
    setSaving(true);
    try {
      // Re-authenticate with the current password before allowing the change.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (reauthErr) {
        setError("Your current password is incorrect.");
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Enter your current password, then choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Current password</Label>
            <Input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">New password</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-[13px] text-bad">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
