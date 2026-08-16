import crypto from "crypto";

/**
 * Gift voucher codes.
 *
 * A code is the only thing standing between a stranger and the balance, so it
 * is generated from crypto.randomInt rather than Math.random, and it is long
 * enough that guessing is not a strategy: 16 characters from a 32-symbol
 * alphabet is 80 bits. At one guess per millisecond, forever, you would not
 * find one. (The lookup is rate-limited as well -- see app/actions/vouchers.ts
 * -- but the entropy is what actually makes brute force pointless.)
 *
 * Crockford's base32: no I, L, O or U. The first three are removed because a
 * person reading a code off a phone screen and typing it into another cannot
 * reliably tell them from 1 and 0; U is dropped so the generator cannot
 * accidentally spell something unfortunate. Input is normalised on the way in
 * (see normalizeVoucherCode), so someone who types O for 0 is still understood.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 4;
const GROUP_LEN = 4;

export const VOUCHER_CODE_PREFIX = "ATO";

export function generateVoucherCode(): string {
  const chars = Array.from(
    { length: GROUPS * GROUP_LEN },
    () => ALPHABET[crypto.randomInt(0, ALPHABET.length)]
  );
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(chars.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN).join(""));
  }
  return `${VOUCHER_CODE_PREFIX}-${groups.join("-")}`;
}

/**
 * What the customer typed, turned into what is stored.
 *
 * Accepts the code with or without its dashes or prefix, in any case, and
 * repairs the substitutions the alphabet is designed to avoid: O/o read as 0,
 * I/L/l read as 1. Someone reading a gift code aloud over the phone should not
 * lose their money to a font.
 */
export function normalizeVoucherCode(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^ATO/, "")
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1");

  if (cleaned.length !== GROUPS * GROUP_LEN) return "";
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(cleaned.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN));
  }
  return `${VOUCHER_CODE_PREFIX}-${groups.join("-")}`;
}

/** Safe to show in a list or a log: enough to identify, not enough to spend. */
export function maskVoucherCode(code: string): string {
  const tail = code.slice(-4);
  return `${VOUCHER_CODE_PREFIX}-••••-••••-••••-${tail}`;
}
