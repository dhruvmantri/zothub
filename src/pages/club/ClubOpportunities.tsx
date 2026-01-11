import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClubLayout } from "@/components/club/ClubLayout";
import { OpportunityManagement } from "@/components/dashboard/OpportunityManagement";
import { useClubData } from "@/hooks/useClubData";

export default function ClubOpportunities() {
  const {
    opportunities,
    isLoading,
    deleteOpportunity,
  } = useClubData();

  return (
    <ClubLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Opportunities</h1>
            <p className="text-muted-foreground mt-1">
              Manage your club's opportunities and positions
            </p>
          </div>
          <Link to="/club/opportunities/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Opportunity
            </Button>
          </Link>
        </div>

        {/* Opportunity List */}
        <OpportunityManagement 
          opportunities={opportunities}
          onDelete={deleteOpportunity}
          isLoading={isLoading}
        />
      </div>
    </ClubLayout>
  );
}
