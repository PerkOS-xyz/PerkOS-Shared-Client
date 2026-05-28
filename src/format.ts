/**
 * Display helpers shared across PerkOS surfaces.
 * Ported from `PerkOS/app/lib/format.ts` without changes.
 */

/**
 * Shortens a wallet address to first 3 + last 4 characters separated by ellipsis.
 * E.g. `0x9F02b48c…2e2a` becomes `0x9…2e2a`.
 */
export function formatAddress(address?: string | null): string {
  if (!address) return "";
  if (address.length <= 7) return address;
  return `${address.slice(0, 3)}…${address.slice(-4)}`;
}

/**
 * Compact relative time — "now", "5m", "2h", "3d", or a "Mon DD" date past one
 * week. Designed for chat sidebars and notification rows where horizontal
 * space is precious. Returns "" if the input is missing or in the future.
 */
export function formatRelativeShort(
  input?: string | Date | null,
  now: Date = new Date()
): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  const ms = now.getTime() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
