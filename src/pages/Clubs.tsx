import { useState, useEffect, useMemo } from "react";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Users, 
  X, 
  Globe, 
  Instagram, 
  Linkedin,
  Briefcase,
  Calendar,
  ArrowUpDown
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const categories = ["All", "Technology", "Business", "Creative", "Service", "Health", "Academic", "Cultural", "Sports"];

type SortOption = "name-asc" | "name-desc" | "most-active";

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      // Get all clubs
      const { data: clubsData, error: clubsError } = await supabase.rpc("get_all_clubs_public");

      if (clubsError) {
        console.error("Error fetching clubs:", clubsError);
        toast.error("Failed to load clubs");
        return;
      }

      // Get opportunity counts per club
      const { data: oppCounts, error: oppError } = await supabase
        .from("opportunities")
        .select("club_id")
        .eq("is_active", true);

      // Get event counts per club (upcoming only)
      const { data: eventCounts, error: eventError } = await supabase
        .from("events")
        .select("club_id")
        .eq("is_active", true)
        .gte("event_date", new Date().toISOString());

      // Count opportunities per club
      const oppCountMap: Record<string, number> = {};
      if (!oppError && oppCounts) {
        oppCounts.forEach((opp) => {
          oppCountMap[opp.club_id] = (oppCountMap[opp.club_id] || 0) + 1;
        });
      }

      // Count events per club
      const eventCountMap: Record<string, number> = {};
      if (!eventError && eventCounts) {
        eventCounts.forEach((event) => {
          eventCountMap[event.club_id] = (eventCountMap[event.club_id] || 0) + 1;
        });
      }

      // Merge counts into clubs
      const clubsWithCounts: Club[] = (clubsData || []).map((club: any) => ({
        ...club,
        opportunity_count: oppCountMap[club.id] || 0,
        event_count: eventCountMap[club.id] || 0,
      }));

      setClubs(clubsWithCounts);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedClubs = useMemo(() => {
    let result = clubs.filter((club) => {
      const matchesSearch =
        club.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (club.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory =
        selectedCategory === "All" ||
        club.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });

    // Sort
    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.club_name.localeCompare(b.club_name));
        break;
      case "name-desc":
        result.sort((a, b) => b.club_name.localeCompare(a.club_name));
        break;
      case "most-active":
        result.sort((a, b) => {
          const aActivity = a.opportunity_count + a.event_count;
          const bActivity = b.opportunity_count + b.event_count;
          return bActivity - aActivity;
        });
        break;
    }

    return result;
  }, [clubs, searchQuery, selectedCategory, sortBy]);

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/50 border-b border-border">
          <div className="container mx-auto px-4 py-12">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Clubs & Organizations
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Explore UCI's vibrant club ecosystem and find your community.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-16 z-40 bg-background border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search clubs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="most-active">Most Active</SelectItem>
                </SelectContent>
              </Select>

              {/* Category filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                  <div className="flex items-start gap-4 mb-4">
                    <Skeleton className="w-14 h-14 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Results count */}
              <p className="text-sm text-muted-foreground mb-6">
                Showing {filteredAndSortedClubs.length} clubs
              </p>

              {/* Grid */}
              {filteredAndSortedClubs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedClubs.map((club) => (
                    <Link
                      key={club.id}
                      to={`/clubs/${club.id}`}
                      className="group block"
                    >
                      <div className="p-6 rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border h-full">
                        {/* Club header */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {club.logo_url ? (
                              <img
                                src={club.logo_url}
                                alt={club.club_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="font-display text-xl font-bold text-muted-foreground">
                                {club.club_name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display text-lg font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                              {club.club_name}
                            </h3>
                            {club.category && (
                              <Badge variant="muted" className="mt-1">
                                {club.category}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {club.description || "No description available"}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {club.opportunity_count} {club.opportunity_count === 1 ? "opportunity" : "opportunities"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {club.event_count} {club.event_count === 1 ? "event" : "events"}
                          </span>
                        </div>

                        {/* Footer with links */}
                        <div className="flex items-center gap-2">
                          {club.website_url && (
                            <a
                              href={club.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                            >
                              <Globe className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                          {club.instagram_url && (
                            <a
                              href={club.instagram_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                            >
                              <Instagram className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                          {club.linkedin_url && (
                            <a
                              href={club.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                            >
                              <Linkedin className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    No clubs found
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {clubs.length === 0
                      ? "No clubs have registered yet. Check back later!"
                      : "Try adjusting your search or filters"}
                  </p>
                  {clubs.length > 0 && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("All");
                      }}
                      className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
