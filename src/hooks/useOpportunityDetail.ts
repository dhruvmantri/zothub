import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentProfileId } from "@/hooks/useStudentProfileId";
import { fetchAppliedOpportunityIds } from "@/lib/queryFns";
import { applicationKeys, authScope, opportunityKeys } from "@/lib/queryKeys";
import type { FormQuestion } from "@/types";

export interface OpportunityDetailData {
  id: string;
  title: string;
  type: string;
  description: string | null;
  requirements: string | null;
  deadline: string | null;
  application_questions: FormQuestion[] | null;
  show_application_count: boolean;
  created_at: string;
  club_id: string;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
    description: string | null;
    website_url: string | null;
  };
  applications: { id: string }[];
}

/** The stored questions are untyped JSON; normalise once, here. */
function parseQuestions(raw: unknown): FormQuestion[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  return (raw as unknown[]).map((q) => {
    const question = q as Record<string, unknown>;
    return {
      id: String(question.id || ""),
      type: (question.type as FormQuestion["type"]) || "short_text",
      question: String(question.question || ""),
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? (question.options as string[]) : undefined,
      placeholder: question.placeholder ? String(question.placeholder) : undefined,
    };
  });
}

/**
 * One role's public page.
 *
 * Returns `null` for "no such role" — it must NOT navigate. A queryFn can run
 * on a background refetch, off-screen, and from a retry; redirecting from
 * inside one teleports someone mid-read. The page renders its designed
 * not-found screen instead (maintainer decision on O13, 2026-09-19): silently
 * bouncing a visitor to the list makes them think they misclicked, and the
 * screen that names what happened already existed but was unreachable.
 */
async function fetchOpportunityDetail(
  opportunityId: string,
  isAuthed: boolean,
): Promise<OpportunityDetailData | null> {
  // application_questions is requested ONLY when logged in — anon holds no
  // column grant for it. That is exactly why the cache key carries the viewer;
  // see the UX21 note on the hook below.
  const { data, error } = (await supabase
    .from("opportunities")
    .select(
      `id, title, type, description, requirements, deadline, ${isAuthed ? "application_questions, " : ""}show_application_count, created_at, club_id, club_profiles (id, club_name, logo_url, description, website_url), applications (id)`,
    )
    .eq("id", opportunityId)
    .eq("is_active", true)
    .maybeSingle()) as unknown as {
    data:
      | (Omit<OpportunityDetailData, "application_questions" | "show_application_count"> & {
          application_questions?: unknown;
          show_application_count: boolean | null;
        })
      | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Failed to load the role: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    application_questions: parseQuestions(data.application_questions),
    show_application_count: data.show_application_count ?? true,
  };
}

/**
 * UX21 — the reason the viewer is in the key.
 *
 * The select above includes `application_questions` only for a signed-in
 * viewer. Key this page by the id alone and the sequence "browse logged out →
 * log in → open the same role" serves the ANON-shaped entry for up to `gcTime`,
 * so the page passes `questions={[]}` to the application form and the student
 * submits an application with **zero answers** to a role whose club requires
 * them. The club receives a blank application and the student cannot tell.
 *
 * It carries the viewer's ID, not an "auth"/"anon" flag: the embedded
 * `applications` array is RLS-shaped PER VIEWER, so a shared "auth" bucket
 * would serve account A's row visibility to account B within `gcTime`. Both
 * variants sit under the `details(id)` prefix, which is what mutations
 * invalidate.
 */
export function useOpportunityDetail(opportunityId: string | undefined) {
  const { user } = useAuth();
  const { studentProfileId } = useStudentProfileId();
  const isAuthed = Boolean(user);

  const detailQuery = useQuery({
    queryKey: opportunityKeys.detail(opportunityId ?? "", authScope(user?.id)),
    queryFn: () => fetchOpportunityDetail(opportunityId!, isAuthed),
    enabled: Boolean(opportunityId),
  });

  // The SAME key the roles list uses (contract C5): same RLS policy, same
  // rows. Arriving here from the list is a cache hit rather than a repeat of a
  // query that just ran, and one invalidation after applying updates both.
  const appliedQuery = useQuery({
    queryKey: applicationKeys.byStudent(studentProfileId ?? "anon"),
    queryFn: () => fetchAppliedOpportunityIds(studentProfileId!),
    enabled: Boolean(studentProfileId),
  });

  return {
    opportunity: detailQuery.data ?? null,
    // `Boolean(opportunityId) &&` — with `enabled` false `isPending` never
    // clears, so a route with no id would render a permanent skeleton.
    isPending: Boolean(opportunityId) && detailQuery.isPending,
    isError: detailQuery.isError,
    isFetching: detailQuery.isFetching,
    refetch: detailQuery.refetch,

    hasApplied: Boolean(opportunityId) && (appliedQuery.data?.includes(opportunityId) ?? false),
  };
}
