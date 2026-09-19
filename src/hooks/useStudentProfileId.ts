import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { studentProfileKeys } from "@/lib/queryKeys";

/**
 * The signed-in student's `student_profiles.id`.
 *
 * `auth.users.id` and `student_profiles.id` are different values, and the
 * application / RSVP tables key on the latter. Resolving it was duplicated
 * verbatim across eight call sites — Opportunities, OpportunityDetail,
 * ApplicationForm, useEventRSVP, StudentDashboard, StudentProfile and
 * StudentProfileEdit — each running its own `select("id")` on mount. Opening a
 * role and applying to it ran the identical query three times.
 *
 * It is cached under its own key rather than derived from `useProfileLookup`,
 * deliberately. `resolveProfile` checks `club_profiles` FIRST, so reusing it and
 * dropping the `!isClub` guard — or copying the guard slightly wrong — would
 * hand a CLUB's `club_profiles.id` to code that writes applications and RSVPs.
 * The cost of keeping them separate is one extra `select("id")`, cached once per
 * session. Correctness over a saved round trip.
 *
 * Returns `null` for a signed-out visitor and for a club account, both of which
 * are legitimate states rather than errors.
 */
async function resolveStudentProfileId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  // maybeSingle(), so "no student profile" arrives as data === null rather than
  // as an error. A real error must throw: swallowing it would cache "this person
  // has no student profile", and every apply/RSVP button would silently refuse.
  if (error) throw new Error(`Failed to resolve student profile: ${error.message}`);
  return data?.id ?? null;
}

export function useStudentProfileId() {
  const { user } = useAuth();
  const userId = user?.id;

  // Keyed on user.id, never the user object — AuthContext produces a new object
  // identity on every TOKEN_REFRESHED for the same person.
  const query = useQuery({
    queryKey: studentProfileKeys.byUser(userId ?? "anon"),
    queryFn: () => resolveStudentProfileId(userId!),
    enabled: Boolean(userId),
    // A profile id does not change for the life of an account.
    staleTime: Infinity,
  });

  return {
    studentProfileId: query.data ?? null,
    // Boolean(userId) && — with `enabled` false, isPending stays true forever,
    // which would leave signed-out visitors staring at a permanent spinner.
    isLoading: Boolean(userId) && query.isPending,
    isError: query.isError,
  };
}

/**
 * Imperative variant for event handlers (submitting an application, RSVPing)
 * that need the id at click time rather than at render time.
 *
 * `fetchQuery` reads through the same cache, so a handler is normally free and
 * never issues a second lookup for a value the page already has.
 */
export function useResolveStudentProfileId() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    return queryClient.fetchQuery({
      queryKey: studentProfileKeys.byUser(userId),
      queryFn: () => resolveStudentProfileId(userId),
      staleTime: Infinity,
    });
  }, [queryClient, userId]);
}
