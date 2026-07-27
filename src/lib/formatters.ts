import { format } from "date-fns";

import {
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_VALUES,
  type OpportunityTypeValue,
} from "@/lib/constants";

/**
 * Format a date string for display as a deadline.
 * Returns "Rolling" if no deadline is provided.
 */
export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Rolling";
  try {
    return format(new Date(deadline), "MMM d, yyyy");
  } catch {
    return "Rolling";
  }
}

/**
 * Format a date string for display (e.g., "Jan 15, 2025").
 */
export function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

/**
 * Format a time string for display (e.g., "2:30 PM").
 */
export function formatTime(dateString: string): string {
  try {
    return format(new Date(dateString), "h:mm a");
  } catch {
    return "";
  }
}

/**
 * Format a date and time for display (e.g., "Jan 15, 2025 at 2:30 PM").
 */
export function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return dateString;
  }
}

/**
 * Get a relative time string (e.g., "2 hours ago", "Yesterday").
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(dateString);
}

/**
 * Normalise an opportunity type to one of the six supported values.
 *
 * This used to silently coerce anything unrecognised to "volunteer", which
 * meant every `committee` and `other` posting was mislabelled on every card in
 * the app — a club would post a Committee role and watch it advertise itself as
 * Volunteer. Structure §3 calls for all six types supported properly, so the
 * coercion is gone; genuinely unknown values fall through to "other".
 */
export function normalizeOpportunityType(type: string): OpportunityTypeValue {
  const normalized = (type || "").toLowerCase().trim();
  return (OPPORTUNITY_TYPE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as OpportunityTypeValue)
    : "other";
}

/** Human label for a type value, e.g. `leadership` → "Leadership Role". */
export function opportunityTypeLabel(type: string): string {
  const value = normalizeOpportunityType(type);
  return OPPORTUNITY_TYPES.find((t) => t.value === value)?.label ?? "Other";
}
