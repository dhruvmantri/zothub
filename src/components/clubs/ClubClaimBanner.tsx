import { Flag } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";

interface ClubClaimBannerProps {
  clubName: string;
  sourceUrl?: string | null;
  importedAt?: string | null;
}

/**
 * Shown ONLY on an unclaimed (ZotSpot-seeded) club's own profile page.
 *
 * The seeded club appears normally in the Clubs directory — unclaimed and claimed
 * are indistinguishable there (maintainer decision); this treatment is
 * profile-page-only. The claim action itself is deferred (the MB5 claim RPC isn't
 * built yet), so the button ships visibly DISABLED with an "Available soon" chip:
 * "not-yet-live, no dead buttons". The source line keeps the listing honest —
 * imported public data, no fabricated activity.
 */
export function ClubClaimBanner({ clubName, sourceUrl, importedAt }: ClubClaimBannerProps) {
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
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button variant="default" disabled aria-disabled title="Claiming opens soon">
              Claim this club
            </Button>
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Available soon
            </span>
          </div>
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
        </div>
      </div>
    </section>
  );
}
