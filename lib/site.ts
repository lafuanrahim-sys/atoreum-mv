/**
 * One description of who this site is, for the machines that read it.
 *
 * Search engines and social scrapers need absolute URLs and a consistent
 * identity, and both must be the SAME on every deployment. That rules out
 * deriving the origin from the request host: a Vercel preview would then
 * declare itself canonical, and Google would index the preview alongside the
 * real site and split the ranking between two addresses for identical pages.
 *
 * So the origin is a constant, overridable only by explicit configuration
 * (SITE_URL, the same variable app/actions/auth.ts uses for password-reset
 * links — the two must agree, or emails and canonicals disagree about where
 * the site lives).
 */

export const SITE_URL = (process.env.SITE_URL?.trim() || "https://atoreum.mv").replace(/\/+$/, "");

export const SITE_NAME = "Atoreum MV";

/** Under 160 characters: past that Google truncates it in the result snippet. */
export const SITE_DESCRIPTION =
  "Authentic Korean skincare in the Maldives. Lebelage cleansers, serums, masks and sun care, delivered in Malé the same evening.";

/**
 * The store as a place of business. Used for the LocalBusiness/Store record
 * on the homepage, which is what lets the site appear for searches like
 * "korean skincare male maldives" rather than only for its own name.
 */
export const STORE = {
  legalName: "Aranzo Investments",
  email: "sales@aranzo.co",
  city: "Malé",
  country: "MV",
  countryName: "Maldives",
  currency: "MVR",
  /** 20-02 is the Malé postal district the stamp on the contact page names. */
  postalCode: "20-02",
} as const;

/** Absolute URL for a site-relative path — what structured data and Open Graph require. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
