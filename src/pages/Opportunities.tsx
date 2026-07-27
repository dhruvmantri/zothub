import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Bookmark, Heart } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { DiscoverList, type DiscoverListRow } from "@/components/discover/DiscoverList";
import { FilterChip } from "@/components/discover/FilterChip";
import { EmptyState } from "@/components/discover/EmptyState";
import { ViewToggle, useDiscoverView } from "@/components/discover/ViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDeadline, normalizeOpportunityType, opportunityTypeLabel } from "@/lib/formatters";
import { OPPORTUNITY_TYPES } from "@/lib/constants";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useAuth } from "@/contexts/AuthContext";

interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  deadline: string | null;
  club_id: string;
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  applications: { id: string }[];
}

/**
 * Categories are the six real opportunity types plus All, Saved and Following.
 * The old list hard-coded four and the formatter silently coerced the other two
 * to "volunteer", so Committee and Other postings were both unfilterable and
 * mislabelled (Structure §3).
 *
 * "Following" is what used to be the separate /student/feed destination
 * (maintainer decision, 2026-07-25). A feed of clubs you follow is a *filter on
 * discovery*, not a fifth place to look — same cards, same sort, same actions.
 * The chip only exists once you actually follow a club, so it can never be a
 * filter that only ever returns nothing.
 */
const BASE_CATEGORIES = OPPORTUNITY_TYPES.map((t) => ({ value: t.value, label: t.label }));

type SortOption = "newest" | "deadline" | "popular";

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const { bookmarkedIds: followedClubIds } = useBookmarks("club");
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    // /student/feed redirects here, so an old bookmark still lands on the
    // student's followed clubs instead of a 404.
    searchParams.get("filter") === "following" ? "following" : "all",
  );
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<Set<string>>(new Set());
  const [view, setView] = useDiscoverView("discover");

  useEffect(() => {
    fetchOpportunities();
    if (user) {
      fetchAppliedOpportunities();
    }
  }, [user]);

  const selectCategory = (value: string) => {
    setSelectedCategory(value);
    // Only "following" is worth keeping in the URL — it is the one filter a
    // student arrives at by link rather than by tapping a chip.
    if (value === "following") setSearchParams({ filter: "following" }, { replace: true });
    else if (searchParams.has("filter")) setSearchParams({}, { replace: true });
  };

  const fetchOpportunities = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("opportunities")
        .select(`
          id,
          title,
          type,
          description,
          deadline,
          club_id,
          club_profiles (
            club_name,
            logo_url
          ),
          applications (
            id
          )
        `)
        .eq("is_active", true)
        .or(`deadline.is.null,deadline.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching opportunities:", error);
        toast.error("Failed to load opportunities");
        return;
      }

      setOpportunities(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppliedOpportunities = async () => {
    if (!user) return;

    try {
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!studentProfile) return;

      const { data: applications } = await supabase
        .from("applications")
        .select("opportunity_id")
        .eq("student_id", studentProfile.id);

      if (applications) {
        setAppliedOpportunityIds(new Set(applications.map((a) => a.opportunity_id)));
      }
    } catch (err) {
      console.error("Error fetching applied opportunities:", err);
    }
  };

  const categories = useMemo(
    () => [
      { value: "all", label: "All" },
      ...(followedClubIds.size > 0
        ? [{ value: "following", label: "Following" }]
        : []),
      { value: "saved", label: "Saved" },
      ...BASE_CATEGORIES,
    ],
    [followedClubIds],
  );

  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((opp) => {
        const clubName = opp.club_profiles?.club_name || "";
        const matchesSearch =
          opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          clubName.toLowerCase().includes(searchQuery.toLowerCase());

        if (selectedCategory === "saved") {
          return matchesSearch && isBookmarked(opp.id);
        }

        if (selectedCategory === "following") {
          return matchesSearch && followedClubIds.has(opp.club_id);
        }

        const matchesCategory =
          selectedCategory === "all" ||
          normalizeOpportunityType(opp.type) === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case "deadline":
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          case "popular":
            return (b.applications?.length || 0) - (a.applications?.length || 0);
          case "newest":
          default:
            return 0;
        }
      });
  }, [opportunities, searchQuery, selectedCategory, sortOption, isBookmarked, followedClubIds]);

  const activeCategory = categories.find((c) => c.value === selectedCategory);
  const hasFilters = searchQuery !== "" || selectedCategory !== "all";

  const listRows: DiscoverListRow[] = filteredOpportunities.map((opp) => {
    const applied = appliedOpportunityIds.has(opp.id);
    return {
      id: opp.id,
      href: `/opportunities/${opp.id}`,
      title: opp.title,
      meta: `Due ${formatDeadline(opp.deadline)} · ${opp.applications?.length || 0} applied`,
      tag: { label: opportunityTypeLabel(opp.type) },
      clubId: opp.club_id,
      clubName: opp.club_profiles?.club_name || "Unknown club",
      clubLogo: opp.club_profiles?.logo_url,
      saved: isBookmarked(opp.id),
      onSave: () => toggleBookmark(opp.id),
      action: applied ? { label: "Applied", disabled: true } : { label: "Apply" },
    };
  });

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Discover
            </h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              Roles and events from UCI clubs — find one, apply, show up.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="discover-search" className="sr-only">
                  Search roles by title or club
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
                />
                <Input
                  id="discover-search"
                  type="search"
                  placeholder="Search roles or clubs…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-11"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-pill text-ink-3 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-full md:w-[190px]" aria-label="Sort roles">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="deadline">Closing soonest</SelectItem>
                    <SelectItem value="popular">Most applied to</SelectItem>
                  </SelectContent>
                </Select>
                <ViewToggle view={view} onChange={setView} className="hidden sm:inline-flex" />
              </div>
            </div>

            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {categories.map((category) => (
                <FilterChip
                  key={category.value}
                  active={selectedCategory === category.value}
                  onClick={() => selectCategory(category.value)}
                >
                  {category.value === "saved" && <Bookmark className="size-3.5" aria-hidden />}
                  {category.value === "following" && <Heart className="size-3.5" aria-hidden />}
                  {category.label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                  <Skeleton className="size-[46px] shrink-0 rounded-[11px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="mt-4 h-9 w-full rounded-pill" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-ink-3">
                <span className="font-data text-ink-2">{filteredOpportunities.length}</span>{" "}
                {filteredOpportunities.length === 1 ? "role" : "roles"}
                {selectedCategory === "following"
                  ? " from clubs you follow"
                  : selectedCategory === "saved"
                    ? " saved"
                    : selectedCategory !== "all" && activeCategory
                      ? ` in ${activeCategory.label}`
                      : ""}
              </p>

              {filteredOpportunities.length > 0 ? (
                view === "cards" ? (
                  <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredOpportunities.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        id={opportunity.id}
                        title={opportunity.title}
                        clubName={opportunity.club_profiles?.club_name || "Unknown club"}
                        clubLogo={opportunity.club_profiles?.logo_url || undefined}
                        type={opportunity.type}
                        deadline={`Due ${formatDeadline(opportunity.deadline)}`}
                        deadlineAt={opportunity.deadline}
                        applicants={opportunity.applications?.length || 0}
                        isBookmarked={isBookmarked(opportunity.id)}
                        onBookmark={() => toggleBookmark(opportunity.id)}
                        hasApplied={appliedOpportunityIds.has(opportunity.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <DiscoverList rows={listRows} />
                )
              ) : (
                /* The empty state describes the QUERY, never the product's stage. */
                <EmptyState
                  title={
                    selectedCategory === "following"
                      ? "Quiet from your clubs —"
                      : hasFilters
                        ? "Nothing matches that yet —"
                        : "No open roles right now —"
                  }
                  signature={
                    selectedCategory === "following"
                      ? "the rest of campus is open."
                      : hasFilters
                        ? "try a wider net."
                        : "events are worth a look."
                  }
                  body={
                    hasFilters
                      ? selectedCategory === "saved"
                        ? "You haven't saved any roles yet. Save one from a card and it'll wait for you here."
                        : selectedCategory === "following"
                          ? "The clubs you follow have nothing open right now. New postings from them show up here first."
                          : "No roles match those filters. Clearing them shows everything that's open."
                      : "Clubs post roles throughout the term. Following a club puts its new postings in front of you."
                  }
                  actions={
                    hasFilters ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          selectCategory("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <a href="/clubs">Browse clubs</a>
                      </Button>
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
