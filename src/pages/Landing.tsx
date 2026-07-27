import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Honest about state (Foundation §2). The hero shows **live counts only** —
 * whatever is actually in the database right now. The page previously claimed
 * "200+ Active Clubs / 10K+ Students" against a marketplace with one club,
 * which any visitor could disprove in two clicks by opening /clubs. Live counts
 * are honest at any scale, including this one, and they grow on their own.
 *
 * Nothing here describes the product's *stage* either — no "we're just getting
 * started", no "coming soon".
 */
function useLiveCounts() {
  const [counts, setCounts] = useState<{ roles: number; events: number; clubs: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date().toISOString();

    Promise.all([
      supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .or(`deadline.is.null,deadline.gte.${now}`),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("event_date", now),
      supabase.rpc("get_all_clubs_public"),
    ])
      .then(([roles, events, clubs]) => {
        if (cancelled) return;
        setCounts({
          roles: roles.count ?? 0,
          events: events.count ?? 0,
          clubs: Array.isArray(clubs.data) ? clubs.data.length : 0,
        });
      })
      .catch(() => {
        /* Counts are decoration on top of the hero — never block it. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

/**
 * Counts are live, so they spend most of their early life at 0 and 1 — the
 * labels have to read correctly there, not only once the numbers are large.
 */
function Count({ value, one, many }: { value: number | null; one: string; many: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-data text-[19px] font-semibold text-white">
        {value === null ? "—" : value}
      </span>
      <span className="text-[13.5px] text-[#E6ECF2]">{value === 1 ? one : many}</span>
    </span>
  );
}

export default function Landing() {
  const counts = useLiveCounts();

  return (
    <RoleBasedLayout>
      {/* ------------------------------- hero -------------------------------
          The scrim is baked in and load-bearing: the white headline, the
          light-blue italic and the counts line clear AA only because of it.
          Never remove it, and re-measure over composited pixels if the art
          changes — contrast here cannot be derived from computed styles.

          Crop is `50% 44%`, the courtyard axis (handoff §5). The warm gradient
          stays underneath as the decode/failure fallback, so the headline is
          never white-on-white while the photo loads or if it 404s. */}
      <section className="relative isolate overflow-hidden bg-[#08101A]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_78%_18%,#F5B971_0%,#C7743A_28%,#5B3E5C_58%,#12243C_82%,#08101A_100%)]"
        />
        <img
          src="/images/hero-campus.jpg"
          alt=""
          aria-hidden
          // This is the LCP element: eager + high priority, but async decode so
          // it never blocks the headline from painting.
          //
          // Spread with the lowercase DOM name: React only learned the
          // camelCase `fetchPriority` prop in 19. On 18.3 it warns and drops
          // the attribute, so the priority hint silently never shipped.
          {...{ fetchpriority: "high" }}
          decoding="async"
          className="absolute inset-0 size-full object-cover [object-position:50%_44%]"
        />
        {/* Two-axis scrim — left-to-right for the text column, bottom-up for
            the counts line.

            These stops are an AA control, not styling. Measured over the real
            composited photo, the subhead landed at 4.34:1 where it crosses a
            sunlit concrete wall; the falloff was moved right (42%→58%) and the
            near stops raised to pull it clear. Re-measure if the art or the
            copy width changes — the gradient-only numbers do not transfer. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,13,22,0.94)_0%,rgba(6,13,22,0.86)_58%,rgba(6,13,22,0.30)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(6,13,22,0)_0%,rgba(6,13,22,0.72)_100%)]"
        />

        <div className="container relative mx-auto px-4 pb-32 pt-20 md:pb-40 md:pt-28">
          <div className="max-w-2xl">
            <h1 className="text-[clamp(38px,6vw,60px)] font-medium leading-[1.04] tracking-[-0.034em] text-white">
              Find your people at UCI —{" "}
              <span className="italic text-[#AFCDF3]">and actually hear back.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#E4EAF1]">
              Clubs post real roles. You apply in a couple of minutes and track every
              application in one place. No spreadsheets, no Google Form graveyard, no silence.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="border-[1.5px] border-white/70 bg-transparent text-white hover:bg-white/10"
              >
                <Link to="/opportunities">Browse roles</Link>
              </Button>
            </div>

            {/* Live counts — the honest alternative to social proof. */}
            <div className="mt-9 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <Count value={counts?.roles ?? null} one="open role" many="open roles" />
              <Count value={counts?.events ?? null} one="upcoming event" many="upcoming events" />
              <Count value={counts?.clubs ?? null} one="club" many="clubs" />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------- the two-sided split ---------------------------
          Fixed-register contexts: the club card is ALWAYS dark and the student
          card ALWAYS light, in both themes. That is what keeps the two-sided
          metaphor alive in dark mode (W4) — and each carries a complete alias
          set, so neither inherits accent across a register boundary (W1). */}
      {/* `relative z-10` is required, not decorative: the hero's scrim layers
          are absolutely positioned, so without a stacking context here they
          paint over the cards that bridge the hero's lower edge. */}
      <section className="container relative z-10 mx-auto -mt-24 px-4 md:-mt-28">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="ctx-dark rounded-xl border border-line p-7 shadow-e4">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent-text">
              For clubs
            </p>
            <h2 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.026em] text-ink">
              Run recruiting, not a spreadsheet.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Post a role in a minute — link the Google Form you already use, or build the
              questions here. Review everyone in one queue, and nobody gets ghosted.
            </p>
            <Button variant="accent" className="mt-6" asChild>
              <Link to="/signup?role=club">Post a role</Link>
            </Button>
          </div>

          <div className="ctx-light rounded-xl border border-line p-7 shadow-e4">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent-text">
              For students
            </p>
            <h2 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.026em] text-ink">
              Apply once. Know where you stand.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Every open role on campus in one place. Apply with the profile you already
              filled in, then watch it move from Applied to a real answer.
            </p>
            <Button variant="accent" className="mt-6" asChild>
              <Link to="/signup?role=student">Find a club</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------- value props ------------------------------ */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
          {[
            {
              n: "01",
              title: "One place to look",
              body: "Roles and events from every club on one surface, filtered how you want it.",
            },
            {
              n: "02",
              title: "Less work than what it replaces",
              body: "A club can be live in under a minute by linking the form it already has.",
            },
            {
              n: "03",
              title: "Nobody gets ghosted",
              body: "Closing a posting prompts the club to answer everyone still waiting.",
            },
          ].map((item) => (
            <div key={item.n} className="bg-surface p-7">
              <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-accent-text">
                {item.n}
              </p>
              <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.018em] text-ink">
                {item.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- footer -------------------------------- */}
      <footer className="border-t border-line bg-surface">
        <div className="container mx-auto flex flex-col items-center justify-between gap-5 px-4 py-9 md:flex-row">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {[
              { to: "/opportunities", label: "Discover" },
              { to: "/events", label: "Events" },
              { to: "/clubs", label: "Clubs" },
              { to: "/privacy", label: "Privacy" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex min-h-11 items-center px-1.5 text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-ink-3">
            &copy; <span className="font-data">{new Date().getFullYear()}</span> ZotHub &middot; built for UCI
          </p>
        </div>
      </footer>
    </RoleBasedLayout>
  );
}
