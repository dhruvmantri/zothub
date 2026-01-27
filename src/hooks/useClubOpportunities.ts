import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DashboardOpportunity } from "@/types";

export function useClubOpportunities(clubId: string | null) {
  const [opportunities, setOpportunities] = useState<DashboardOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOpportunities = useCallback(async () => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: opps, error: oppsError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (oppsError) {
      console.error("Error fetching opportunities:", oppsError);
      setIsLoading(false);
      return;
    }

    // Get application counts for each opportunity
    const oppIds = opps?.map(o => o.id) || [];
    const { data: appCounts } = await supabase
      .from("applications")
      .select("opportunity_id")
      .in("opportunity_id", oppIds);

    const countMap: Record<string, number> = {};
    appCounts?.forEach(app => {
      countMap[app.opportunity_id] = (countMap[app.opportunity_id] || 0) + 1;
    });

    setOpportunities(
      (opps || []).map(o => ({
        ...o,
        views: o.views || 0,
        applications_count: countMap[o.id] || 0,
      }))
    );
    setIsLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const deleteOpportunity = async (id: string) => {
    const { error } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting opportunity:", error);
      toast.error("Failed to delete opportunity");
      return false;
    }

    toast.success("Opportunity deleted");
    fetchOpportunities();
    return true;
  };

  return {
    opportunities,
    isLoading,
    deleteOpportunity,
    refetchOpportunities: fetchOpportunities,
  };
}
