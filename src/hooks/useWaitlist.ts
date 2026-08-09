import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

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

// Admin view currently uses the same shape; extend here if it diverges.
type WaitlistAdminEntry = WaitlistEntry;

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
      // Grant the role. Idempotent (ON CONFLICT DO NOTHING) so re-approving —
      // or approving a legacy account that already holds the role — never
      // fails on the (user_id, role) unique key.
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role },
          { onConflict: "user_id,role", ignoreDuplicates: true }
        );

      if (roleError) {
        console.error("Error inserting role:", roleError);
        return { success: false, error: roleError.message };
      }

      // Record the reviewing admin for the audit trail (null-safe if the
      // session can't be resolved for any reason).
      const { data: { user: adminUser } } = await supabase.auth.getUser();

      // Update waitlist status
      const { error: waitlistError } = await supabase
        .from("waitlist")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUser?.id ?? null,
        })
        .eq("user_id", userId);

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        return { success: false, error: waitlistError.message };
      }

      // Send approval email. The recipient is DERIVED server-side from the
      // waitlist row (admin-authoritative handler) — no client-chosen recipient.
      // The approval itself already succeeded, so a failed email is reported
      // separately (emailSent) rather than failing the whole action or — worse —
      // being silently presented as "notified".
      const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-email", {
        body: {
          type: "waitlist_approved",
          data: { waitlistUserId: userId },
        },
      });
      const emailResult = checkEmailResult(emailErr, emailData);
      if (!emailResult.ok) console.error("waitlist_approved email failed:", emailResult.error);

      await fetchAllEntries();
      return { success: true, emailSent: emailResult.ok, emailError: emailResult.error };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  };

  const rejectUser = async (userId: string, email: string, reason?: string) => {
    try {
      // Record the reviewing admin for the audit trail (null-safe).
      const { data: { user: adminUser } } = await supabase.auth.getUser();

      const { error: waitlistError } = await supabase
        .from("waitlist")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUser?.id ?? null,
        })
        .eq("user_id", userId);

      if (waitlistError) {
        console.error("Error updating waitlist:", waitlistError);
        return { success: false, error: waitlistError.message };
      }

      // Send rejection email. Recipient derived server-side from the waitlist row.
      const { data: emailData, error: emailErr } = await supabase.functions.invoke("send-email", {
        body: {
          type: "waitlist_rejected",
          data: { waitlistUserId: userId, reason },
        },
      });
      const emailResult = checkEmailResult(emailErr, emailData);
      if (!emailResult.ok) console.error("waitlist_rejected email failed:", emailResult.error);

      await fetchAllEntries();
      return { success: true, emailSent: emailResult.ok, emailError: emailResult.error };
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
