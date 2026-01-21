import { useState, useEffect } from "react";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
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
import { Search, X, Bookmark, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDeadline, normalizeOpportunityType } from "@/lib/formatters";
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

const categories = ["All", "Saved", "Leadership", "Project", "Internship", "Volunteer", "Committee", "Other"];

type SortOption = "newest" | "deadline" | "popular";

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOpportunities();
    if (user) {
      fetchAppliedOpportunities();
    }
  }, [user]);

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
        .order("created_at", { ascending: false });

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
      // Get student profile first
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!studentProfile) return;

      // Get applied opportunity IDs
      const { data: applications } = await supabase
        .from("applications")
        .select("opportunity_id")
        .eq("student_id", studentProfile.id);

      if (applications) {
        setAppliedOpportunityIds(new Set(applications.map(a => a.opportunity_id)));
      }
    } catch (err) {
      console.error("Error fetching applied opportunities:", err);
    }
  };


  const filteredOpportunities = opportunities
    .filter((opp) => {
      const clubName = opp.club_profiles?.club_name || "";
      const matchesSearch =
        opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clubName.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Handle "Saved" category
      if (selectedCategory === "Saved") {
        return matchesSearch && isBookmarked(opp.id);
      }
      
      const matchesCategory =
        selectedCategory === "All" ||
        opp.type.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "deadline":
          // Opportunities with deadlines first, sorted by deadline ascending
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case "popular":
          return (b.applications?.length || 0) - (a.applications?.length || 0);
        case "newest":
        default:
          return 0; // Already sorted by created_at from query
      }
    });


  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/50 border-b border-border">
          <div className="container mx-auto px-4 py-12">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Opportunities
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover leadership roles, projects, internships, and volunteer positions from UCI clubs.
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
                  placeholder="Search opportunities..."
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
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="deadline">Deadline Approaching</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 mt-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {category === "Saved" && <Bookmark className="w-3.5 h-3.5" />}
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Results count */}
              <p className="text-sm text-muted-foreground mb-6">
                Showing {filteredOpportunities.length} opportunities
              </p>

              {/* Grid */}
              {filteredOpportunities.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOpportunities.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      id={opportunity.id}
                      title={opportunity.title}
                      clubName={opportunity.club_profiles?.club_name || "Unknown Club"}
                      clubLogo={opportunity.club_profiles?.logo_url || undefined}
                      type={normalizeOpportunityType(opportunity.type)}
                      deadline={formatDeadline(opportunity.deadline)}
                      description={opportunity.description || "No description provided"}
                      applicants={opportunity.applications?.length || 0}
                      isBookmarked={isBookmarked(opportunity.id)}
                      onBookmark={() => toggleBookmark(opportunity.id)}
                      hasApplied={appliedOpportunityIds.has(opportunity.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    No opportunities found
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {opportunities.length === 0
                      ? "No opportunities have been posted yet. Check back later!"
                      : "Try adjusting your search or filters"}
                  </p>
                  {opportunities.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("All");
                      }}
                    >
                      Clear filters
                    </Button>
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
