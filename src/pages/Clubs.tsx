import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, X, Globe, Instagram, Linkedin } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { FilterChip } from "@/components/discover/FilterChip";
import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CLUB_CATEGORIES } from "@/lib/constants";

interface Club {
  id: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  opportunity_count: number;
  event_count: number;
}

type SortOption = "name-asc" | "name-desc" | "most-active";

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      const { data: clubsData, error: clubsError } = await supabase.rpc("get_all_clubs_public");

      if (clubsError) {
        console.error("Error fetching clubs:", clubsError);
        toast.error("Failed to load clubs");
        return;
      }

      const now = new Date().toISOString();
      const { data: oppCounts, error: oppError } = await supabase
        .from("opportunities")
        .select("club_id")
        .eq("is_active", true)
        .or(`deadline.is.null,deadline.gte.${now}`);

      const { data: eventCounts, error: eventError } = await supabase
        .from("events")
        .select("club_id")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString());

      const oppCountMap: Record<string, number> = {};
      if (!oppError && oppCounts) {
        oppCounts.forEach((opp) => {
          oppCountMap[opp.club_id] = (oppCountMap[opp.club_id] || 0) + 1;
        });
      }

      const eventCountMap: Record<string, number> = {};
      if (!eventError && eventCounts) {
        eventCounts.forEach((event) => {
          eventCountMap[event.club_id] = (eventCountMap[event.club_id] || 0) + 1;
        });
      }

      setClubs(
        (clubsData || []).map((club) => ({
          ...club,
          opportunity_count: oppCountMap[club.id] || 0,
          event_count: eventCountMap[club.id] || 0,
        })),
      );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Only offer categories that some club actually uses. The old list hard-coded
   * nine labels ("Creative", "Service"…) that did not exist in
   * CLUB_CATEGORIES at all, so most real categories were unfilterable and
   * several chips could never match anything. Deriving from the data means the
   * filter bar can never drift from the taxonomy again.
   */
  const categories = useMemo(() => {
    const used = new Set(clubs.map((c) => c.category).filter(Boolean) as string[]);
    return [
      { value: "all", label: "All" },
      ...CLUB_CATEGORIES.filter((c) => used.has(c)).map((c) => ({ value: c, label: c })),
    ];
  }, [clubs]);

  const filteredAndSortedClubs = useMemo(() => {
    const result = clubs.filter((club) => {
      const matchesSearch =
        club.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (club.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = selectedCategory === "all" || club.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.club_name.localeCompare(b.club_name));
        break;
      case "name-desc":
        result.sort((a, b) => b.club_name.localeCompare(a.club_name));
        break;
      case "most-active":
        result.sort(
          (a, b) =>
            b.opportunity_count + b.event_count - (a.opportunity_count + a.event_count),
        );
        break;
    }

    return result;
  }, [clubs, searchQuery, selectedCategory, sortBy]);

  const recruitingCount = clubs.filter((c) => c.opportunity_count > 0).length;
  const hasFilters = searchQuery !== "" || selectedCategory !== "all";

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Clubs
            </h1>
            {/* Honest asymmetry: most clubs are not recruiting at any given
                moment, and saying so is more useful than implying they all are. */}
            <p className="mt-2 text-ink-2">
              <span className="font-data">{clubs.length}</span>{" "}
              {clubs.length === 1 ? "club" : "clubs"} ·{" "}
              <span className="font-data">{recruitingCount}</span> recruiting right now
            </p>
          </div>
        </div>

        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="clubs-search" className="sr-only">
                  Search clubs by name or description
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
                />
                <Input
                  id="clubs-search"
                  type="search"
                  placeholder="Search clubs…"
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

              <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                <SelectTrigger className="w-full md:w-[190px]" aria-label="Sort clubs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A–Z</SelectItem>
                  <SelectItem value="name-desc">Name Z–A</SelectItem>
                  <SelectItem value="most-active">Most active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categories.length > 1 && (
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((category) => (
                  <FilterChip
                    key={category.value}
                    active={selectedCategory === category.value}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    {category.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface p-5">
                  <Skeleton className="size-[52px] shrink-0 rounded-[13px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedClubs.length > 0 ? (
            <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedClubs.map((club) => (
                <article
                  key={club.id}
                  className="group relative flex flex-col rounded-lg border border-line bg-surface p-5 shadow-e1 transition-[box-shadow,transform,border-color] duration-base ease-zh hover:-translate-y-0.5 hover:border-line-2 hover:shadow-e3"
                >
                  <div className="flex gap-3">
                    <EntityAvatar
                      name={club.club_name}
                      src={club.logo_url}
                      kind="org"
                      size="lg"
                      className="size-[52px] shrink-0 text-[19px]"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.018em]">
                        <Link
                          to={`/clubs/${club.id}`}
                          className="text-ink after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                        >
                          {club.club_name}
                        </Link>
                      </h2>
                      {club.category && (
                        <div className="mt-1.5">
                          <Tag variant="neutral">{club.category}</Tag>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-ink-2">
                    {club.description || "No description yet."}
                  </p>

                  <p className="mt-3 text-[12.5px] text-ink-3">
                    {club.opportunity_count > 0 ? (
                      <span className="font-semibold text-accent-text">
                        <span className="font-data">{club.opportunity_count}</span> open{" "}
                        {club.opportunity_count === 1 ? "role" : "roles"}
                      </span>
                    ) : (
                      "Not recruiting"
                    )}
                    {" · "}
                    <span className="font-data">{club.event_count}</span>{" "}
                    {club.event_count === 1 ? "event" : "events"}
                  </p>

                  {(club.website_url || club.instagram_url || club.linkedin_url) && (
                    <div className="relative z-10 mt-auto flex gap-1 pt-4">
                      {[
                        { url: club.website_url, Icon: Globe, name: "website" },
                        { url: club.instagram_url, Icon: Instagram, name: "Instagram" },
                        { url: club.linkedin_url, Icon: Linkedin, name: "LinkedIn" },
                      ]
                        .filter((l) => l.url)
                        .map(({ url, Icon, name }) => (
                          <Button
                            key={name}
                            variant="ghost"
                            size="icon-sm"
                            asChild
                            aria-label={`${club.club_name} ${name}`}
                          >
                            <a href={url!} target="_blank" rel="noopener noreferrer">
                              <Icon className="size-4" />
                            </a>
                          </Button>
                        ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={hasFilters ? "No clubs match that —" : "No clubs yet —"}
              signature={hasFilters ? "try a wider search." : "check back soon."}
              body={
                hasFilters
                  ? "Nothing here matches those filters. Clearing them shows every club."
                  : "Clubs are being onboarded. Roles and events appear here as they join."
              }
              actions={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="outline" asChild>
                    <Link to="/opportunities">Browse roles</Link>
                  </Button>
                )
              }
            />
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
