import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WaitlistStatus = "pending" | "approved" | "rejected" | null;

interface WaitlistEntry {
  id: string;
  user_id: string;
  email: string;
  role: "student" | "club";
  status: WaitlistStatus;
  rejection_reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface WaitlistAdminEntry extends WaitlistEntry {
  // Additional fields for admin view
}

export function useWaitlist() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WaitlistStatus>(null);
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWaitlistStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setEntry(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching waitlist status:", error);
        setStatus(null);
        setEntry(null);
      } else if (data) {
        setStatus(data.status as WaitlistStatus);
        setEntry(data as WaitlistEntry);
      } else {
        // No waitlist entry means user is approved (or admin)
        setStatus(null);
        setEntry(null);
      }
    } catch (err) {
      console.error("Error fetching waitlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWaitlistStatus();
  }, [fetchWaitlistStatus]);

  return {
    status,
    entry,
    isLoading,
    refetch: fetchWaitlistStatus,
  };
}

export function useWaitlistAdmin() {
  const [entries, setEntries] = useState<WaitlistAdminEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Error fetching waitlist entries:", error);
      } else {
        setEntries((data || []) as WaitlistAdminEntry[]);
      }
    } catch (err) {
      console.error("Error fetching waitlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllEntries();
  }, [fetchAllEntries]);

  const approveUser = async (userId: string, email: string, role: "student" | "club") => {
    try {
      // Insert into user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (roleError) {
        console.error("Error inserting role:", roleError);
        return { success: false, error: roleError.message };
      }

      // Update waitlist status
      const { error: waitlistError } = await supabase
        .from("waitlist")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        return { success: false, error: waitlistError.message };
      }

      // Send approval email
      await supabase.functions.invoke("send-email", {
        body: {
          type: "waitlist_approved",
          to: email,
          data: { role },
        },
      });

      await fetchAllEntries();
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const rejectUser = async (userId: string, email: string, reason?: string) => {
    try {
      const { error: waitlistError } = await supabase
        .from("waitlist")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        return { success: false, error: waitlistError.message };
      }

      // Send rejection email
      await supabase.functions.invoke("send-email", {
        body: {
          type: "waitlist_rejected",
          to: email,
          data: { reason },
        },
      });

      await fetchAllEntries();
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const deleteEntry = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("waitlist")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return { success: false, error: error.message };
      }

      await fetchAllEntries();
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  return {
    entries,
    isLoading,
    refetch: fetchAllEntries,
    approveUser,
    rejectUser,
    deleteEntry,
  };
}
