import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers for viewing files stored in Supabase Storage.
 *
 * FileUpload stores `getPublicUrl(...)` URLs for every bucket, but
 * `student-resumes` is a PRIVATE bucket — its public-style URLs never resolve.
 * Private objects must be opened through a short-lived signed URL instead.
 * (See plan.md Bug Inventory: "[Storage] Uploaded resumes are unreadable".)
 *
 * These helpers convert a stored URL back to `{ bucket, path }` and mint a
 * signed URL when the bucket is private. External links (Google Drive etc.)
 * and public-bucket URLs pass through unchanged.
 */

const PRIVATE_BUCKETS = ["student-resumes"];

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

interface ParsedStorageUrl {
  bucket: string;
  path: string;
}

/**
 * Parse a Supabase Storage object URL (public or sign variant) into its
 * bucket and object path. Returns null for anything else (external URLs).
 */
export function parseStorageUrl(url: string): ParsedStorageUrl | null {
  const match = url.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/
  );
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/**
 * Resolve a stored file URL to something the current user can actually open.
 * For private buckets this creates a signed URL (subject to storage RLS —
 * e.g. clubs can only sign resumes of students who applied to them).
 */
export async function resolveFileUrl(url: string): Promise<string> {
  const parsed = parseStorageUrl(url);
  if (!parsed || !PRIVATE_BUCKETS.includes(parsed.bucket)) {
    return url;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not generate a download link");
  }

  return data.signedUrl;
}

/**
 * Open a stored file in a new tab, resolving private-bucket URLs to signed
 * URLs first. The tab is opened synchronously (before the async resolve) so
 * popup blockers don't eat it.
 */
export async function openFileUrl(url: string): Promise<void> {
  const newTab = window.open("", "_blank", "noopener,noreferrer");
  try {
    const resolved = await resolveFileUrl(url);
    if (newTab) {
      newTab.location.href = resolved;
    } else {
      window.open(resolved, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    newTab?.close();
    throw err;
  }
}
