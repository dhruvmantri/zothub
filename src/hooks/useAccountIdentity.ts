import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfileLookup";

export interface AccountIdentity {
  displayName: string;
  subtitle: string;
  avatarUrl: string | null;
  /** True until the profile lookup settles — so prominent surfaces can show a
   *  skeleton instead of flashing the email local-part as if it were a name. */
  isLoading: boolean;
}

/**
 * Who the signed-in account is, for the nav avatar and account menu.
 *
 * Now reads through the shared TanStack Query cache (UX15) instead of running its
 * own `useEffect` + `useState`. That is the actual fix for UX7: the old version
 * re-resolved the profile on every mount, and the nav remounts per route, so the
 * avatar showed the email-derived initials ("MA") and then corrected itself
 * ("DM") on EVERY navigation. The profile is now resolved once and reused, so
 * `isLoading` is true only on the genuine first load of a session.
 *
 * Consumers must still honour `isLoading` — rendering the fallback while loading
 * is what produced the flash in the first place.
 */
export function useAccountIdentity(): AccountIdentity {
  const { user, role } = useAuth();
  const { data: profile, isPending } = useProfile(user?.id);

  // A club's email local-part ("skhan7") is not its name — only fall back to it
  // for students, where the handle often reads as a person. Clubs get a neutral
  // placeholder, and prominent surfaces should prefer the isLoading skeleton.
  const fallbackName =
    role === "club" ? "Your club" : user?.email?.split("@")[0] || "You";

  if (profile) {
    return {
      displayName: profile.name,
      subtitle: profile.isClub ? "Club" : "Student · UCI",
      avatarUrl: profile.avatar ?? null,
      isLoading: false,
    };
  }

  return {
    displayName: fallbackName,
    subtitle: role === "club" ? "Club" : "Student · UCI",
    avatarUrl: null,
    // Signed out is a settled state, not a loading one — otherwise every
    // logged-out surface renders a permanent skeleton.
    isLoading: Boolean(user) && isPending,
  };
}
