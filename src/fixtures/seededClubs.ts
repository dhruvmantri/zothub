/**
 * Local fixtures for building/verifying the club-seeding (MB5) UI WITHOUT touching
 * the database. Only consumed by the DEV-only preview at /dev/clubs-preview.
 * Not imported by any shipped route.
 *
 * Covers the representative cases: unclaimed vs claimed, missing logo, missing
 * description, a long description, and the three new categories (Cultural &
 * Identity, Environment & Sustainability, Greek Life).
 */
import type { ClubCardData } from "@/components/clubs/ClubCard";

export interface FixtureClub extends ClubCardData {
  // profile-page fields (ClubDetail): unclaimed ≡ source set & not yet claimed
  user_id: string | null;
  source: string | null;
  source_url: string | null;
  imported_at: string | null;
  claimed_at: string | null;
}

// A tiny self-contained logo (blue rounded square) to prove the logo path renders
// alongside the initials-fallback cards — no network fetch.
const SAMPLE_LOGO =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Crect%20width='100'%20height='100'%20rx='22'%20fill='%230F5FA8'/%3E%3Ctext%20x='50'%20y='63'%20font-size='42'%20fill='white'%20text-anchor='middle'%20font-family='sans-serif'%3EAI%3C/text%3E%3C/svg%3E";

const IMPORTED = "2026-07-01T00:00:00.000Z";

export const FIXTURE_CLUBS: FixtureClub[] = [
  {
    // Unclaimed · missing logo · short description · NEW category (Greek Life)
    id: "fx-greek",
    club_name: "Sigma Theta Tau",
    category: "Greek Life",
    description: "A social fraternity focused on brotherhood, service, and leadership.",
    logo_url: null,
    website_url: "https://example.org/sigma",
    instagram_url: null,
    linkedin_url: null,
    opportunity_count: 0,
    event_count: 0,
    user_id: null,
    source: "zotspot",
    source_url: "https://zotspot.uci.edu/student_community?club_id=00001",
    imported_at: IMPORTED,
    claimed_at: null,
  },
  {
    // Unclaimed · MISSING description · has socials · NEW category (Environment)
    id: "fx-enviro",
    club_name: "Anteaters for a Greener Campus",
    category: "Environment & Sustainability",
    description: null,
    logo_url: null,
    website_url: "https://example.org/green",
    instagram_url: "https://instagram.com/green",
    linkedin_url: null,
    opportunity_count: 0,
    event_count: 0,
    user_id: null,
    source: "zotspot",
    source_url: "https://zotspot.uci.edu/student_community?club_id=00002",
    imported_at: IMPORTED,
    claimed_at: null,
  },
  {
    // Unclaimed · missing logo · LONG description · NEW category (Cultural)
    id: "fx-cultural",
    club_name: "Vietnamese Student Association",
    category: "Cultural & Identity",
    description:
      "The Vietnamese Student Association at UC Irvine is a community that celebrates and preserves Vietnamese culture through cultural showcases, community-service initiatives, mentorship, and social events. We host our annual culture night, language exchanges, food fundraisers, and general meetings throughout the year, and we welcome members of every background who want to learn, connect, and build lasting friendships across the wider Anteater community.",
    logo_url: null,
    website_url: null,
    instagram_url: "https://instagram.com/vsa",
    linkedin_url: null,
    opportunity_count: 0,
    event_count: 0,
    user_id: null,
    source: "zotspot",
    source_url: "https://zotspot.uci.edu/student_community?club_id=00003",
    imported_at: IMPORTED,
    claimed_at: null,
  },
  {
    // Unclaimed · BOTH logo and description missing (edge) · existing category
    id: "fx-bare",
    club_name: "Quiet Study Collective",
    category: "Health & Wellness",
    description: null,
    logo_url: null,
    website_url: null,
    instagram_url: null,
    linkedin_url: null,
    opportunity_count: 0,
    event_count: 0,
    user_id: null,
    source: "zotspot",
    source_url: "https://zotspot.uci.edu/student_community?club_id=00004",
    imported_at: IMPORTED,
    claimed_at: null,
  },
  {
    // CLAIMED contrast · has a logo · is recruiting — proves claimed and unclaimed
    // are indistinguishable in the directory apart from real, honest counts.
    id: "fx-claimed",
    club_name: "AI @ UCI",
    category: "Technology",
    description: "Student-run club building and shipping applied machine-learning projects.",
    logo_url: SAMPLE_LOGO,
    website_url: "https://example.org/ai",
    instagram_url: "https://instagram.com/aiuci",
    linkedin_url: "https://linkedin.com/company/aiuci",
    opportunity_count: 3,
    event_count: 2,
    user_id: "00000000-0000-0000-0000-000000000001",
    source: null,
    source_url: null,
    imported_at: null,
    claimed_at: null,
  },
];

export const FIXTURE_UNCLAIMED = FIXTURE_CLUBS.find((c) => c.id === "fx-cultural")!;
