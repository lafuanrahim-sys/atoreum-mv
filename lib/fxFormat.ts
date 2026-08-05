/** Shared number formatting for the dollar exchange tracker — see CLAUDE.md's money rules in the ported spec: MVR/USD with 2 decimals and thousands separators, rates to 2 decimals, support_pct stored as a fraction but always displayed as a percentage. */

export function formatMvr(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRate(value: number): string {
  return value.toFixed(2);
}

/** `fraction` is the stored value (0.499853), not a percentage. */
export function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

/**
 * `dateStr` is a plain "YYYY-MM-DD" calendar date (trade_date/tt_date have
 * no time-of-day or timezone). Deliberately does not go through `new
 * Date(dateStr).toLocaleDateString()` — a date-only string parses as UTC
 * midnight, and re-displaying that through the runtime's *local* timezone
 * can land on the previous calendar day for any server behind UTC (this
 * app's own dev machine happens to be ahead of UTC, which hid the bug
 * there — Vercel's default region is not). Plain string slicing has no
 * timezone to get wrong.
 */
export function formatFxDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}
