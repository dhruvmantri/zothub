/**
 * Is a social sign-in provider switched on for this Supabase project? (backlog A7)
 *
 * `signInWithOAuth` does not ask. It builds the `/authorize` URL and navigates,
 * so when the provider is off in the dashboard the visitor lands on Supabase's
 * raw JSON 400 ("Unsupported provider: provider is not enabled") on a
 * supabase.co address — which is what every "Sign in with UCI Google" tap did
 * from the move to the self-owned project until it was measured on 2026-10-10.
 * GoTrue's public `/auth/v1/settings` says which providers are on, so ask it
 * first.
 *
 * `true` / `false` when the project answered; `null` when it could not be asked
 * (network, timeout, an unexpected shape). Callers treat `null` as "try anyway":
 * failing closed on a blip would block a working sign-in to guard against a
 * broken one, and the worst case of trying is the old behaviour.
 */
export function providerEnabled(settings: unknown, provider: string): boolean | null {
  if (!settings || typeof settings !== "object") return null;
  const external = (settings as { external?: unknown }).external;
  if (!external || typeof external !== "object") return null;
  const value = (external as Record<string, unknown>)[provider];
  return typeof value === "boolean" ? value : null;
}

export async function isProviderEnabled(
  supabaseUrl: string,
  publishableKey: string,
  provider: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return providerEnabled(await res.json(), provider);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
