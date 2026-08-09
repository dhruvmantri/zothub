import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClaimRow {
  id: string;
  club_id: string;
  claimant_email: string;
  note: string | null;
  status: string;
  email_status: string | null;
  created_at: string;
  club_profiles: { club_name: string } | null;
}

type ReviewResult = {
  emailSent?: boolean;
  emailError?: string;
};

/**
 * Admin queue for club-claim requests (MB5). Approving invokes review-club-claim,
 * which binds the seeded profile to an owner (existing or newly-created account),
 * grants the role, and emails a set-password / login link. The panel reports the
 * TRUE email-delivery result and lists approvals whose email failed so an admin
 * can resend. Rejecting notifies the claimant.
 */
export function ClubClaimsPanel() {
  const { toast } = useToast();
  const [pending, setPending] = useState<ClaimRow[]>([]);
  const [needsResend, setNeedsResend] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ClaimRow | null>(null);
  const [approveFor, setApproveFor] = useState<ClaimRow | null>(null);
  const [reason, setReason] = useState("");

  const columns =
    "id, club_id, claimant_email, note, status, email_status, created_at, club_profiles(club_name)";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [pendingRes, resendRes] = await Promise.all([
      supabase
        .from("club_claim_requests")
        .select(columns)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      // Approval OR rejection emails that failed to send — both are retryable.
      supabase
        .from("club_claim_requests")
        .select(columns)
        .in("status", ["approved", "rejected"])
        .eq("email_status", "failed")
        .order("created_at", { ascending: true }),
    ]);
    // Surface a real error instead of masquerading as an empty queue.
    if (pendingRes.error || resendRes.error) {
      setLoadError(
        pendingRes.error?.message ?? resendRes.error?.message ?? "Could not load claim requests.",
      );
      setPending([]);
      setNeedsResend([]);
    } else {
      setPending((pendingRes.data as unknown as ClaimRow[]) ?? []);
      setNeedsResend((resendRes.data as unknown as ClaimRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (
    requestId: string,
    action: "approve" | "reject" | "resend",
    rsn?: string,
  ) => {
    setBusyId(requestId);
    try {
      const { data, error } = await supabase.functions.invoke("review-club-claim", {
        body: { requestId, action, reason: rsn },
      });
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json();
        throw new Error(body.error || "Action failed.");
      }
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = (data ?? {}) as ReviewResult;
      if (action === "reject") {
        // Only say "notified" when the rejection email actually went out.
        toast({
          title: result.emailSent ? "Claim rejected" : "Rejected — email NOT sent",
          description: result.emailSent
            ? "The claimant was notified."
            : `The claim was rejected, but the email failed${result.emailError ? `: ${result.emailError}` : ""}. Use Resend.`,
          variant: result.emailSent ? undefined : "destructive",
        });
      } else if (action === "resend") {
        toast({ title: "Email resent", description: "The email was delivered." });
      } else if (result.emailSent === false) {
        // Approved, but be honest: the email did NOT go out.
        toast({
          title: "Approved — email NOT sent",
          description:
            (result.emailError ? `${result.emailError} ` : "") +
            "The account is set up; use Resend to deliver the link.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Claim approved",
          description: "Account bound and a set-password / login email was sent.",
        });
      }
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Action failed.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setRejectFor(null);
      setApproveFor(null);
      setReason("");
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Club claims ({pending.length})</CardTitle>
        <CardDescription>
          Pending requests to claim seeded (ZotSpot) club pages. Approving binds the page to the
          claimant's account (created if needed), grants the club role, and emails a set-password or
          login link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <div className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-sm text-bad">Couldn't load claims: {loadError}</p>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        ) : pending.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No pending claims.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{r.club_profiles?.club_name ?? "Unknown club"}</p>
                  <p className="text-sm text-ink-2">{r.claimant_email}</p>
                  {r.note && <p className="mt-1 text-[13px] text-ink-3">“{r.note}”</p>}
                  <p className="mt-1 text-[12px] text-ink-3">
                    Requested {format(new Date(r.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-ok/40 text-ok hover:bg-ok-wash hover:text-ok"
                    disabled={busyId === r.id}
                    onClick={() => setApproveFor(r)}
                    aria-label={`Approve claim for ${r.club_profiles?.club_name ?? "club"}`}
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-bad/40 text-bad hover:bg-bad-wash hover:text-bad"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setRejectFor(r);
                      setReason("");
                    }}
                    aria-label={`Reject claim for ${r.club_profiles?.club_name ?? "club"}`}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Approved claims whose email failed to send — recoverable via resend. */}
        {!loading && !loadError && needsResend.length > 0 && (
          <div className="mt-6 rounded-lg border border-bad/30 bg-bad-wash/40 p-4">
            <p className="text-sm font-semibold text-ink">
              Email not delivered ({needsResend.length})
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              These claims were reviewed, but the approval / rejection email failed to send.
              Resend it.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {needsResend.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {r.club_profiles?.club_name ?? "Unknown club"}
                    </p>
                    <p className="text-[13px] text-ink-2">{r.claimant_email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => review(r.id, "resend")}
                  >
                    <RefreshCw className="size-4" />
                    Resend email
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      {/* Approve confirmation — shows exactly which club and email are affected. */}
      <Dialog open={!!approveFor} onOpenChange={(o) => !o && setApproveFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve this claim?</DialogTitle>
            <DialogDescription>
              This creates a dedicated club account for{" "}
              <strong>{approveFor?.claimant_email}</strong>, binds{" "}
              <strong>{approveFor?.club_profiles?.club_name ?? "the club"}</strong> to it, grants
              the club role, and emails a set-password link. It also rejects any other pending
              claims for this club.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={busyId === approveFor?.id}
              onClick={() => approveFor && review(approveFor.id, "approve")}
            >
              Approve claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject claim</DialogTitle>
            <DialogDescription>
              Optionally add a reason — it's included in the email to {rejectFor?.claimant_email}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === rejectFor?.id}
              onClick={() => rejectFor && review(rejectFor.id, "reject", reason || undefined)}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
