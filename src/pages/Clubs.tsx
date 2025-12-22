import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";

// Mock data for clubs
const mockClubs = [
  {
    id: "1",
    name: "Anteater Blockchain",
    category: "Technology",
    description: "Exploring blockchain technology and its applications through workshops, projects, and industry connections.",
    members: 150,
    logo: null,
  },
  {
    id: "2",
    name: "Design at UCI",
    category: "Creative",
    description: "A community of designers passionate about user experience, visual design, and creative problem-solving.",
    members: 200,
    logo: null,
  },
  {
    id: "3",
    name: "Data Science UCI",
    category: "Technology",
    description: "Empowering students to explore data science through hands-on projects, competitions, and research.",
    members: 320,
    logo: null,
  },
  {
    id: "4",
    name: "Circle K International",
    category: "Service",
    description: "The largest collegiate service organization dedicated to service, leadership, and fellowship.",
    members: 180,
    logo: null,
  },
  {
    id: "5",
    name: "Investment Club",
    category: "Business",
    description: "Learn about investing, personal finance, and wealth management through workshops and simulations.",
    members: 250,
    logo: null,
  },
  {
    id: "6",
    name: "Hack at UCI",
    category: "Technology",
    description: "Organizing hackathons and tech events to bring together innovators and creators.",
    members: 400,
    logo: null,
  },
  {
    id: "7",
    name: "Pre-Med Society",
    category: "Health",
    description: "Supporting pre-medical students with resources, mentorship, and clinical opportunities.",
    members: 500,
    logo: null,
  },
  {
    id: "8",
    name: "Entrepreneurship Club",
    category: "Business",
    description: "Fostering entrepreneurial spirit through speaker events, pitch competitions, and startup resources.",
    members: 175,
    logo: null,
  },
];

const categories = ["All", "Technology", "Business", "Creative", "Service", "Health"];

export default function ClubsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredClubs = mockClubs.filter((club) => {
    const matchesSearch = club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || club.category === selectedCategory;
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
                    <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="font-display text-xl font-bold text-muted-foreground">
                        {club.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                        {club.name}
                      </h3>
                      <Badge variant="muted" className="mt-1">
                        {club.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {club.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{club.members} members</span>
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
