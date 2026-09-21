import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useWaitlist } from "@/hooks/useWaitlist";
import { VerificationFailed } from "@/components/auth/VerificationFailed";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("student" | "club" | "admin")[];
}

/**
 * The route guard.
 *
 * The order of these checks is load-bearing, and A5 is why. The final check
 * used to read `allowedRoles && role && !allowedRoles.includes(role)` — and
 * when `role` was `null` that whole condition was false, so execution fell
 * through to `return children`. An account with no role therefore rendered
 * EVERY protected page, on both sides: a role-less visitor reached the club
 * dashboard, complete with the club navigation. Reproduced in a browser on
 * 2026-09-21, not inferred.
 *
 * Two things reached that state: provisioning that never finished (a Google
 * sign-in with no intended role recorded), and — the ordinary one — the
 * waitlist read simply FAILING, because a failed read set the status to
 * `null`, which this file treats as "approved".
 *
 * Nothing leaked: RLS is the real gate, and creating either profile requires
 * the matching role, so a role-less account could not write and the pages came
 * up empty. It was a fail-open guard rather than a breach — which is exactly
 * the kind of thing that becomes a breach the day someone adds a page that
 * leans on the guard instead of on RLS.
 *
 * The rule now: KNOWN states are honoured first, an UNKNOWN is never guessed
 * in either direction, and only then is entitlement decided.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading, roleError } = useAuth();
  const {
    status: waitlistStatus,
    isLoading: waitlistLoading,
    isError: waitlistError,
    refetch: refetchWaitlist,
  } = useWaitlist();
  const location = useLocation();

  if (isLoading || waitlistLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // --- Known states win, even if the other read failed -------------------
  // A pending user has no role BY DESIGN (roles are granted at approval), so
  // a failed role read must not push them to a retry screen when the waitlist
  // has already given us the real answer.
  if (waitlistStatus === "pending") {
    return <Navigate to="/waitlist" replace />;
  }
  if (waitlistStatus === "rejected") {
    return <Navigate to="/waitlist-rejected" replace />;
  }

  // --- An unknown is not an answer ---------------------------------------
  // Neither letting them in (the original bug) nor silently locking them out
  // (which would eject an approved student over one flaky request). Rendered
  // in place, so a successful retry returns them to the page they asked for.
  if (roleError || waitlistError) {
    return (
      <VerificationFailed
        onRetry={() => {
          refetchWaitlist();
          // The role is read once at start-up and the context exposes no
          // refetch, so a reload is the only honest way to re-run it. There is
          // nothing cached on this screen to lose.
          window.location.reload();
        }}
      />
    );
  }

  // --- Entitlement --------------------------------------------------------
  // No role and the read SUCCEEDED: this account genuinely has none, so it is
  // not entitled to any protected page. This is the branch whose absence was
  // the defect.
  if (allowedRoles && !role) {
    return <Navigate to="/account-setup" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "club") return <Navigate to="/applicants" replace />;
    return <Navigate to="/activity" replace />;
  }

  return <>{children}</>;
}
