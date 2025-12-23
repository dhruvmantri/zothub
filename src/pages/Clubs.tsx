import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, ExternalLink, X, Globe, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Club {
  id: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
}

const categories = ["All", "Technology", "Business", "Creative", "Service", "Health", "Academic", "Cultural", "Sports"];

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      const { data, error } = await supabase
        .from("club_profiles")
        .select(`
          id,
          club_name,
          category,
          description,
          logo_url,
          website_url,
          instagram_url,
          linkedin_url
        `)
        .order("club_name", { ascending: true });

      if (error) {
        console.error("Error fetching clubs:", error);
        toast.error("Failed to load clubs");
        return;
      }

      setClubs(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClubs = clubs.filter((club) => {
    const matchesSearch =
      club.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (club.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory =
      selectedCategory === "All" ||
      club.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50">
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
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
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
                Showing {filteredClubs.length} clubs
              </p>

              {/* Grid */}
              {filteredClubs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClubs.map((club) => (
                    <div
                      key={club.id}
                      className="group p-6 rounded-2xl bg-card shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50"
                    >
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

                      {/* Footer with links */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {club.website_url && (
                            <a
                              href={club.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
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
                              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                            >
                              <Linkedin className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/clubs/${club.id}`}>
                            View
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
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
