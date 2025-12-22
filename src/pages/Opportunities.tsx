import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter, SlidersHorizontal, X } from "lucide-react";

// Mock data for opportunities
const mockOpportunities = [
  {
    id: "1",
    title: "Marketing Director",
    clubName: "Anteater Blockchain",
    type: "leadership" as const,
    deadline: "Jan 15, 2025",
    description: "Lead our marketing initiatives and grow our community presence across social media platforms and campus events.",
    applicants: 24
  },
  {
    id: "2",
    title: "Frontend Developer",
    clubName: "Design at UCI",
    type: "project" as const,
    deadline: "Jan 20, 2025",
    description: "Help build our new portfolio website using React and modern web technologies. Great opportunity for learning.",
    applicants: 18
  },
  {
    id: "3",
    title: "Summer Research Intern",
    clubName: "Data Science UCI",
    type: "internship" as const,
    deadline: "Feb 1, 2025",
    description: "Work on cutting-edge machine learning projects with our research team. Stipend provided.",
    applicants: 45
  },
  {
    id: "4",
    title: "Event Volunteer Coordinator",
    clubName: "Circle K International",
    type: "volunteer" as const,
    deadline: "Jan 10, 2025",
    description: "Coordinate volunteers for our upcoming community service events and manage volunteer schedules.",
    applicants: 12
  },
  {
    id: "5",
    title: "Finance Director",
    clubName: "Investment Club",
    type: "leadership" as const,
    deadline: "Jan 25, 2025",
    description: "Manage club finances, budgets, and help members learn about personal finance and investing.",
    applicants: 15
  },
  {
    id: "6",
    title: "Mobile App Developer",
    clubName: "Hack at UCI",
    type: "project" as const,
    deadline: "Jan 30, 2025",
    description: "Join our team building the official hackathon app. Experience with React Native preferred.",
    applicants: 22
  },
];

const categories = ["All", "Leadership", "Project", "Internship", "Volunteer"];

export default function OpportunitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const filteredOpportunities = mockOpportunities.filter((opp) => {
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.clubName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || 
      opp.type.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
                  {...opportunity}
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
                Try adjusting your search or filters
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
