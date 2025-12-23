import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

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

const categories = ["All", "Leadership", "Project", "Internship", "Volunteer", "Committee", "Other"];

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOpportunities();
    if (user) {
      fetchBookmarks();
    }
  }, [user]);

  const fetchOpportunities = async () => {
    try {
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

  const fetchBookmarks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("opportunity_id")
        .eq("user_id", user.id)
        .not("opportunity_id", "is", null);

      if (error) {
        console.error("Error fetching bookmarks:", error);
        return;
      }

      const ids = new Set(data?.map((b) => b.opportunity_id).filter(Boolean) as string[]);
      setBookmarkedIds(ids);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const toggleBookmark = async (id: string) => {
    if (!user) {
      toast.error("Please log in to bookmark opportunities");
      return;
    }

    const isBookmarked = bookmarkedIds.has(id);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("opportunity_id", id);

        if (error) throw error;

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user.id,
          opportunity_id: id,
        });

        if (error) throw error;

        setBookmarkedIds((prev) => new Set(prev).add(id));
        toast.success("Opportunity bookmarked");
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const clubName = opp.club_profiles?.club_name || "";
    const matchesSearch =
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clubName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" ||
      opp.type.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return "Rolling";
    try {
      return format(new Date(deadline), "MMM d, yyyy");
    } catch {
      return "Rolling";
    }
  };

  const getOpportunityType = (type: string): "leadership" | "project" | "internship" | "volunteer" => {
    const validTypes = ["leadership", "project", "internship", "volunteer"];
    return validTypes.includes(type.toLowerCase()) 
      ? (type.toLowerCase() as "leadership" | "project" | "internship" | "volunteer")
      : "volunteer";
  };

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50">
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
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
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
                <div key={i} className="p-6 rounded-2xl bg-card border border-border/50">
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
                      type={getOpportunityType(opportunity.type)}
                      deadline={formatDeadline(opportunity.deadline)}
                      description={opportunity.description || "No description provided"}
                      applicants={opportunity.applications?.length || 0}
                      isBookmarked={bookmarkedIds.has(opportunity.id)}
                      onBookmark={() => toggleBookmark(opportunity.id)}
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
    </Layout>
  );
}
