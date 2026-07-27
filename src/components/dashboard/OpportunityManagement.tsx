import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStatus, getPostingStatus } from "@/lib/status";
import { opportunityTypeLabel } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Clock,
  Filter,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import type { DashboardOpportunity } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";

interface OpportunityManagementProps {
  opportunities: DashboardOpportunity[];
  onDelete: (id: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function OpportunityManagement({ opportunities, onDelete, isLoading }: OpportunityManagementProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [opportunityToDelete, setOpportunityToDelete] = useState<DashboardOpportunity | null>(null);

  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getPostingStatus(opp);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!opportunityToDelete) return;
    await onDelete(opportunityToDelete.id);
    setOpportunityToDelete(null);
  };

  if (isLoading) {
    return <PageLoader />;
  }

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
                {statusFilter === "all" ? "All statuses" : getStatus("posting", statusFilter).label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>Live</DropdownMenuItem>
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
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {filteredOpportunities.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 mx-auto text-ink-3 mb-4" />
            <p className="text-ink-2">
              {opportunities.length === 0 ? "No opportunities posted yet" : "No opportunities found"}
            </p>
            {opportunities.length === 0 && (
              <Link to="/club/opportunities/new">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  Create your first opportunity
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="text-left text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Opportunity
                  </th>
                  <th className="text-left text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Type
                  </th>
                  <th className="text-left text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Deadline
                  </th>
                  <th className="text-left text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Stats
                  </th>
                  <th className="text-right text-xs font-medium text-ink-2 uppercase tracking-wider px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredOpportunities.map((opportunity) => {
                  return (
                    <tr key={opportunity.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-ink">{opportunity.title}</p>
                          <p className="font-data text-xs text-ink-3">
                            Created {format(new Date(opportunity.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Tag variant="neutral">{opportunityTypeLabel(opportunity.type)}</Tag>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge domain="posting" status={getPostingStatus(opportunity)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-ink-2">
                          <Clock className="w-3.5 h-3.5" />
                          {opportunity.deadline
                            ? format(new Date(opportunity.deadline), "MMM d, yyyy")
                            : "Rolling"
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4 font-data text-sm text-ink-2">
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            {opportunity.views}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {opportunity.applications_count}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${opportunity.title}`}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => navigate(`/club/opportunities/${opportunity.id}/edit`)}
                              className="gap-2"
                            >
                              <Edit className="w-4 h-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setOpportunityToDelete(opportunity)}
                              className="gap-2 text-destructive"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!opportunityToDelete} onOpenChange={() => setOpportunityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{opportunityToDelete?.title}"? 
              This will also delete all associated applications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
