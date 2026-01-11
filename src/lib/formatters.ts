import { format } from "date-fns";

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
 * Validate and normalize an opportunity type to a known type.
 */
export function normalizeOpportunityType(
  type: string
): "leadership" | "project" | "internship" | "volunteer" {
  const validTypes = ["leadership", "project", "internship", "volunteer"];
  const normalized = type.toLowerCase();
  return validTypes.includes(normalized)
    ? (normalized as "leadership" | "project" | "internship" | "volunteer")
    : "volunteer";
}
