import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Clock,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Opportunity {
  id: string;
  title: string;
  type: "leadership" | "project" | "internship" | "volunteer";
  status: "active" | "closed" | "draft";
  deadline: string;
  views: number;
  applications: number;
  createdAt: string;
}

const mockOpportunities: Opportunity[] = [
  {
    id: "1",
    title: "Technical Lead - Web Development",
    type: "leadership",
    status: "active",
    deadline: "Jan 15, 2025",
    views: 342,
    applications: 24,
    createdAt: "Dec 1, 2024"
  },
  {
    id: "2",
    title: "Marketing Intern",
    type: "internship",
    status: "active",
    deadline: "Jan 20, 2025",
    views: 189,
    applications: 15,
    createdAt: "Dec 5, 2024"
  },
  {
    id: "3",
    title: "Campus Outreach Volunteer",
    type: "volunteer",
    status: "active",
    deadline: "Jan 10, 2025",
    views: 256,
    applications: 32,
    createdAt: "Dec 3, 2024"
  },
  {
    id: "4",
    title: "Mobile App Development Project",
    type: "project",
    status: "closed",
    deadline: "Dec 15, 2024",
    views: 421,
    applications: 45,
    createdAt: "Nov 20, 2024"
  },
  {
    id: "5",
    title: "Event Coordinator",
    type: "leadership",
    status: "draft",
    deadline: "Jan 25, 2025",
    views: 0,
    applications: 0,
    createdAt: "Dec 18, 2024"
  },
];

const typeColors = {
  leadership: "accent",
  project: "success",
  internship: "default",
  volunteer: "muted"
} as const;

const statusColors = {
  active: "success",
  closed: "muted",
  draft: "secondary"
} as const;

export function OpportunityManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOpportunities = mockOpportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || opp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {statusFilter === "all" ? "All Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("closed")}>Closed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/club/opportunities/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Opportunity
            </Button>
          </Link>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Opportunity
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Deadline
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Stats
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOpportunities.map((opportunity) => (
                <tr key={opportunity.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{opportunity.title}</p>
                      <p className="text-xs text-muted-foreground">Created {opportunity.createdAt}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={typeColors[opportunity.type]} className="capitalize">
                      {opportunity.type}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusColors[opportunity.status]} className="capitalize">
                      {opportunity.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {opportunity.deadline}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {opportunity.views}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {opportunity.applications}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2">
                          <Eye className="w-4 h-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <Edit className="w-4 h-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <Trash2 className="w-4 h-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOpportunities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No opportunities found</p>
          </div>
        )}
      </div>
    </div>
  );
}
