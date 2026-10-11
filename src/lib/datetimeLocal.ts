/**
 * `<input type="datetime-local">` speaks the visitor's LOCAL wall-clock time,
 * with no zone: "2026-10-20T18:00". The database stores an instant (UTC).
 *
 * The edit forms used to fill the input with `toISOString().slice(0, 16)` —
 * the UTC wall-clock — which the input then shows, and the save path reads
 * back, as LOCAL time. In California that moved an event or deadline 7 hours
 * later (8 in winter) on EVERY save, including a save that only fixed a typo,
 * and the reminder emails moved with it (found 2026-10-10, audit G6-02).
 * Create was never affected: it only ever goes local → instant.
 */

/** Stored instant → the value a datetime-local input should show here. */
export function toDatetimeLocalValue(instant: string | Date): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** A datetime-local value (local wall-clock) → the instant to store. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
