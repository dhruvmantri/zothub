import { useTheme } from "next-themes";

import { ClubCard } from "@/components/clubs/ClubCard";
import { ClubClaimBanner } from "@/components/clubs/ClubClaimBanner";
import { EntityAvatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/discover/EmptyState";
import { FIXTURE_CLUBS, FIXTURE_UNCLAIMED } from "@/fixtures/seededClubs";

/**
 * DEV-ONLY visual harness for the club-seeding (MB5) UI, driven entirely by local
 * fixtures — no database, no seeding. Registered only when import.meta.env.DEV
 * (see App.tsx), so it never ships to production.
 *
 * Verifies the two acceptance criteria:
 *  1. Directory is UNIFORM — unclaimed and claimed clubs render identically.
 *  2. The unclaimed distinction appears only on the club's PROFILE page
 *     (claim banner + source line + "not on ZotHub yet" empty state).
 */
export default function ClubsPreview() {
  const { resolvedTheme, setTheme } = useTheme();
  const u = FIXTURE_UNCLAIMED;

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="border-b border-line bg-surface">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-text">
              DEV preview · not shipped
            </p>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
              Club seeding (MB5) — fixture harness
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            Toggle theme ({resolvedTheme})
          </Button>
        </div>
      </div>

      <div className="container mx-auto flex flex-col gap-12 px-4 py-8">
        {/* 1 — Directory: claimed + unclaimed are indistinguishable */}
        <section>
          <h2 className="mb-1 text-[18px] font-semibold tracking-[-0.018em] text-ink">
            1 · Clubs directory — uniform
          </h2>
          <p className="mb-4 text-[13.5px] text-ink-2">
            Four unclaimed (seeded) clubs + one claimed (“AI @ UCI”, with a logo and open roles).
            Missing logos fall back to initials; missing descriptions read “No description yet.” No
            “unclaimed” marker anywhere here.
          </p>
          <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FIXTURE_CLUBS.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        </section>

        {/* 2 — Profile page: the unclaimed treatment */}
        <section>
          <h2 className="mb-1 text-[18px] font-semibold tracking-[-0.018em] text-ink">
            2 · Unclaimed club profile — the distinction lives here
          </h2>
          <p className="mb-4 text-[13.5px] text-ink-2">
            Same club (“{u.club_name}”), now on its own page: claim banner (disabled CTA), source
            line, and the imported-listing empty state.
          </p>

          <div className="rounded-lg border border-line bg-surface p-6">
            {/* faux profile header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <EntityAvatar name={u.club_name} src={u.logo_url} kind="org" size="xxl" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[clamp(24px,3vw,30px)] font-medium leading-tight tracking-[-0.026em] text-ink">
                  {u.club_name}
                </h3>
                {u.category && (
                  <div className="mt-2">
                    <Tag variant="neutral">{u.category}</Tag>
                  </div>
                )}
                {u.description && (
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{u.description}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <ClubClaimBanner clubName={u.club_name} sourceUrl={u.source_url} importedAt={u.imported_at} />
            </div>

            <div className="mt-6">
              <h4 className="mb-3 text-[18px] font-semibold tracking-[-0.018em] text-ink">Open roles</h4>
              <EmptyState
                title="Not on ZotHub yet —"
                signature="this is an imported listing."
                body={`${u.club_name} hasn't claimed its page, so it can't post roles or events here yet.`}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
