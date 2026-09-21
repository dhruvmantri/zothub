import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Mail, RotateCw, UserCog } from "lucide-react";

import { AccountStateCard } from "@/components/auth/AccountStateCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Where a signed-in account with NO ROLE lands (A5, maintainer decision
 * 2026-09-21).
 *
 * This state should not happen. A role is granted at approval, and every
 * usable account has one — so arriving here means provisioning did not finish,
 * most often a Google sign-in whose intended role was never recorded.
 *
 * It is NOT the waitlist page, deliberately. Telling someone with no waitlist
 * entry that we are "reviewing their application" would have them waiting for
 * a review that is never coming — the same class of false claim as an empty
 * state that promises events there are none of.
 *
 * The retry is a full reload rather than a refetch. Everything that could be
 * wrong here — the session, the role read, the provisioning call — is
 * established once at start-up, so reloading is both the most reliable retry
 * and the one with nothing to lose: there is no cached work on this screen.
 */
export default function AccountSetup() {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  // If a role turns up (the retry worked, or provisioning finished in another
  // tab), leave immediately — nobody should sit on this screen once their
  // account works.
  useEffect(() => {
    if (isLoading || !role) return;
    navigate(role === "club" ? "/applicants" : role === "admin" ? "/admin" : "/activity", {
      replace: true,
    });
  }, [isLoading, role, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2">
        <PageLoader size="md" />
      </div>
    );
  }

  // Signed out, this page has nothing to say.
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AccountStateCard
      icon={UserCog}
      title="We're still finishing your setup"
      description="Your account exists, but it isn't finished — so there's nothing for you to use yet."
      actions={
        <>
          <Button onClick={() => window.location.reload()}>
            <RotateCw className="mr-2 size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/help">Get help</Link>
          </Button>
          {/* Not "browse without an account" — they HAVE one; that is the
              whole problem. Naming it wrongly here would be the same class of
              false claim this screen exists to avoid. */}
          <Button variant="ghost" asChild>
            <Link to="/opportunities">Look around in the meantime</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
        <div className="flex items-center gap-2">
          <Mail className="size-4" aria-hidden />
          <span>{user.email}</span>
        </div>
        <p>
          Trying again usually sorts it. If it keeps happening, get in touch and
          we'll finish it by hand — nothing you've done is lost.
        </p>
      </div>
    </AccountStateCard>
  );
}
