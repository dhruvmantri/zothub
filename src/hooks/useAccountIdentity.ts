import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useProfileLookup } from "@/hooks/useProfileLookup";

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
 * Reuses the existing `useProfileLookup` resolver (club first, then student)
 * rather than adding another profile query — it is already cached and already
 * handles both shapes. Falls back to the email local-part so the nav still
 * reads as a person before the profile lands.
 */
type ResolvedIdentity = Omit<AccountIdentity, "isLoading">;

export function useAccountIdentity(): AccountIdentity {
  const { user, role } = useAuth();
  const { fetchProfileInfo } = useProfileLookup();
  const [identity, setIdentity] = useState<ResolvedIdentity | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIdentity(null);
      setSettled(true);
      return;
    }
    setSettled(false);
    fetchProfileInfo(user.id).then((p) => {
      if (cancelled) return;
      if (p) {
        setIdentity({
          displayName: p.name,
          subtitle: p.isClub ? "Club" : "Student · UCI",
          avatarUrl: p.avatar ?? null,
        });
      }
      setSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, fetchProfileInfo]);

  // A club's email local-part ("skhan7") is not its name — only fall back to it
  // for students, where the handle often reads as a person. Clubs get a neutral
  // placeholder, and prominent surfaces should prefer the isLoading skeleton.
  const fallbackName =
    role === "club" ? "Your club" : user?.email?.split("@")[0] || "You";

  const resolved: ResolvedIdentity =
    identity ?? {
      displayName: fallbackName,
      subtitle: role === "club" ? "Club" : "Student · UCI",
      avatarUrl: null,
    };

  return { ...resolved, isLoading: !settled && !identity };
}
