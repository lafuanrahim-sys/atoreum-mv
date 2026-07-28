/**
 * A small maintained list of known disposable/temporary-email domains
 * (BOLI_SPEC.md §6.1 item 2) — blocked from unlocking Boli Dive regardless
 * of REQUIRE_VERIFIED_EMAIL_FOR_GAME, since this needs no new
 * infrastructure to enforce. Not exhaustive (new disposable-mail services
 * appear constantly); it raises the cost of casual multi-accounting rather
 * than eliminating it, same spirit as every other §6.1 control.
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "sharklasers.com",
  "maildrop.cc",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
]);

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain && DISPOSABLE_EMAIL_DOMAINS.has(domain));
}
