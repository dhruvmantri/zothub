import { useState } from "react";
import { Flag } from "lucide-react";
import { format } from "date-fns";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TurnstileWidget, TURNSTILE_ENABLED } from "@/components/security/TurnstileWidget";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClubClaimBannerProps {
  clubName: string;
  clubId: string;
  sourceUrl?: string | null;
  importedAt?: string | null;
}

/**
 * Shown ONLY on an unclaimed (ZotSpot-seeded) club's own profile page, and ONLY to
 * signed-out visitors.
 *
 * Claims are LOGGED-OUT ONLY: for ANY signed-in user this component renders
 * NOTHING at all (no banner, no CTA, no nudge). A claim always creates a SEPARATE
 * club account for the submitted dedicated club email; `submit-club-claim` rejects
 * authenticated submissions server-side, which is the authoritative enforcement.
 */
export function ClubClaimBanner({ clubName, clubId, sourceUrl, importedAt }: ClubClaimBannerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your club's email.");
      return;
    }
    // Submission is blocked until the captcha yields a valid token.
    if (TURNSTILE_ENABLED && !captchaToken) {
      setError("Please complete the verification challenge first.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("submit-club-claim", {
        body: {
          clubId,
          email: email.trim(),
          note: note.trim() || null,
          turnstileToken: captchaToken ?? undefined,
        },
      });
      if (fnErr instanceof FunctionsHttpError) {
        const body = await fnErr.context.json();
        throw new Error(body.error || "Couldn't submit your claim.");
      }
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDialog = () => {
    setSubmitted(false);
    setError(null);
    setOpen(true);
  };

  // Signed in → render nothing at all. Claims are logged-out-only, so there is no
  // banner, CTA, or nudge for an authenticated visitor.
  if (user) return null;

  const provenance = (
    <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
      {sourceUrl ? (
        <>
          Imported from the{" "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ZotSpot public directory
          </a>
        </>
      ) : (
        "Imported from the ZotSpot public directory"
      )}
      {importedAt ? ` · ${format(new Date(importedAt), "MMM yyyy")}` : ""}
      {" · public info only, no activity fabricated"}
    </p>
  );

  return (
    <section
      aria-label="This club is unclaimed"
      className="rounded-lg border border-accent-line bg-accent-wash p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent-text"
        >
          <Flag className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">Is this your club?</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
            {clubName} is an imported public listing. Claim it to post roles and events,
            message students, and manage this page.
          </p>

          <div className="mt-3">
            <Button variant="default" onClick={openDialog}>
              Claim this club
            </Button>
          </div>

          {provenance}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim {clubName}</DialogTitle>
            <DialogDescription>
              Submit your club's email and we'll review it. Once approved, you'll get an email to
              set your password and start managing this club's page.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-ok/40 bg-ok-wash p-4 text-[14px] text-ink">
                Thanks — your claim for <strong>{clubName}</strong> is in. We'll review it and
                email <strong>{email}</strong> with next steps.
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="claim-email">Your club's email</Label>
                <Input
                  id="claim-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@yourclub.org"
                  required
                />
                <p className="text-[12px] text-ink-3">
                  Use a dedicated club email you control — you'll set the account password with it
                  after approval. It doesn't need to be @uci.edu.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-note">
                  Note <span className="font-normal text-ink-3">(optional)</span>
                </Label>
                <Textarea
                  id="claim-note"
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder="Your role in the club, or anything that helps us verify."
                  rows={3}
                />
              </div>
              <TurnstileWidget onToken={setCaptchaToken} />
              {error && <p className="text-[13px] text-bad">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || (TURNSTILE_ENABLED && !captchaToken)}>
                  {submitting ? "Submitting…" : "Submit claim"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
