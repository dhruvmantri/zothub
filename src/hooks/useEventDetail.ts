import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authScope, eventKeys } from "@/lib/queryKeys";
import type { FormQuestion } from "@/types";

export interface EventDetailData {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  rsvp_questions: FormQuestion[] | null;
  requires_approval: boolean | null;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
  };
  /** Trigger-maintained (O5-counts), CONFIRMED RSVPs only — matching
   *  `enforce_rsvp_capacity`, the authority on who holds a seat. Replaces
   *  counting an embedded `rsvps` array that RLS filtered to the viewer's own
   *  rows, so "spots left" was computed from 0 for a logged-out visitor and a
   *  FULL event advertised every seat as available. Dropping the embed also
   *  takes per-viewer data out of the cached payload. */
  confirmed_rsvps_count: number;
}

/**
 * One event's public page.
 *
 * Returns `null` for "no such event" rather than throwing, so the page can tell
 * a dead link from an outage. `.maybeSingle()` for the same reason `ClubDetail`
 * uses it: with `.single()` a genuine 404 arrives as a thrown PGRST116, so
 * `retry: 1` pays for every missing event twice and "removed" and "the network
 * failed" become the same screen.
 */
async function fetchEventDetail(
  eventId: string,
  isAuthed: boolean,
): Promise<EventDetailData | null> {
  // rsvp_questions is requested ONLY when logged in — anon holds no column
  // grant for it. That asymmetry is precisely why the key carries the viewer;
  // see the UX21 note on the hook below.
  const { data, error } = (await supabase
    .from("events")
    .select(
      `id, title, description, event_date, location, capacity, banner_url, requires_approval, confirmed_rsvps_count, ${isAuthed ? "rsvp_questions, " : ""}club_profiles (id, club_name, logo_url)`,
    )
    .eq("id", eventId)
    .maybeSingle()) as unknown as {
    data: (Omit<EventDetailData, "rsvp_questions"> & { rsvp_questions?: unknown }) | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Failed to load the event: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    rsvp_questions: Array.isArray(data.rsvp_questions)
      ? (data.rsvp_questions as unknown as FormQuestion[])
      : null,
  };
}

/**
 * UX21, event side — a data-loss bug, not a performance one.
 *
 * The select above includes `rsvp_questions` only for a signed-in viewer. Key
 * this page by the event id alone and the sequence "browse logged out → log in
 * → open the same event" serves the ANON-shaped entry for up to `gcTime`:
 * `hasQuestions` reads false, the RSVP path skips the form entirely, and the
 * student is recorded as attending with `answers: []` for an event whose club
 * asked questions. The club gets a blank RSVP and neither side can tell.
 *
 * It carries the viewer's ID, not an "auth"/"anon" flag: the embedded `rsvps`
 * array is RLS-shaped PER VIEWER, so a shared "auth" bucket would serve account
 * A's row visibility to account B inside `gcTime`. Both variants live under the
 * `details(id)` prefix, which is what the RSVP mutations invalidate.
 */
export function useEventDetail(eventId: string | undefined) {
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  const query = useQuery({
    queryKey: eventKeys.detail(eventId ?? "", authScope(user?.id)),
    queryFn: () => fetchEventDetail(eventId!, isAuthed),
    enabled: Boolean(eventId),
  });

  return {
    event: query.data ?? null,
    // `Boolean(eventId) &&` — with `enabled` false `isPending` never clears, so
    // a route with no id would render a skeleton that never resolves.
    isPending: Boolean(eventId) && query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
