/**
 * Centralized constants and enums used across the application.
 * Import from "@/lib/constants" to use these values.
 */

// ============= Admin Allowlist =============

// Emails allowed to bypass @uci.edu restriction (admin accounts)
export const ADMIN_ALLOWED_EMAILS = ["zothub.uci@gmail.com"];

// ============= Opportunity Types =============

export const OPPORTUNITY_TYPES = [
  { value: "leadership", label: "Leadership Role" },
  { value: "project", label: "Project Team" },
  { value: "internship", label: "Internship" },
  { value: "volunteer", label: "Volunteer" },
  { value: "committee", label: "Committee" },
  { value: "other", label: "Other" },
] as const;

export const OPPORTUNITY_TYPE_VALUES = [
  "leadership",
  "project",
  "internship",
  "volunteer",
  "committee",
  "other",
] as const;

export type OpportunityTypeValue = (typeof OPPORTUNITY_TYPE_VALUES)[number];

// ============= Student Year Options =============

export const YEAR_OPTIONS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
  "PhD",
] as const;

export type YearOption = (typeof YEAR_OPTIONS)[number];

// ============= Club Categories =============

export const CLUB_CATEGORIES = [
  "Academic",
  "Arts & Culture",
  "Business & Finance",
  "Community Service",
  "Cultural & Identity",
  "Engineering",
  "Environment & Sustainability",
  "Gaming & Esports",
  "Greek Life",
  "Health & Wellness",
  "Media & Journalism",
  "Music & Performance",
  "Political & Advocacy",
  "Professional Development",
  "Religious & Spiritual",
  "Science & Research",
  "Social",
  "Sports & Recreation",
  "Technology",
  "Other",
] as const;

export type ClubCategory = (typeof CLUB_CATEGORIES)[number];

// ============= Skill Suggestions =============

export const SKILL_SUGGESTIONS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Python",
  "Java",
  "C++",
  "Node.js",
  "SQL",
  "Machine Learning",
  "Data Analysis",
  "UI/UX Design",
  "Project Management",
  "Marketing",
  "Public Speaking",
  "Leadership",
  "Graphic Design",
  "Video Editing",
  "Writing",
  "Research",
] as const;

// ============= Interest Suggestions =============

export const INTEREST_SUGGESTIONS = [
  "Technology",
  "Business",
  "Arts",
  "Sports",
  "Music",
  "Gaming",
  "Photography",
  "Community Service",
  "Entrepreneurship",
  "Finance",
  "Healthcare",
  "Environment",
  "Education",
  "Research",
  "Social Impact",
] as const;
