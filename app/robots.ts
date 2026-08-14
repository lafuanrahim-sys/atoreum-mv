import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * What crawlers may read.
 *
 * The storefront is open — that is the entire point. Everything disallowed
 * below is either private, personalised, or worthless in a search result:
 *
 *   /dashboard, /fx   staff-only. Already behind auth, but a crawler that
 *                     finds a link shouldn't spend its crawl budget being
 *                     redirected to /login.
 *   /invoice          a customer's tax invoice. Admin-gated; listed here so
 *                     it can never be indexed by accident.
 *   /account, /checkout, /order-confirmation
 *                     per-person pages. An order confirmation carries a name,
 *                     an address and an access token in the URL.
 *   /login            nothing to rank for.
 *   /api              not documents.
 *
 * Disallow is not a security control — it is a request, and only well-behaved
 * crawlers honour it. Every one of these paths is independently protected;
 * this just keeps them out of results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/fx", "/invoice", "/account", "/checkout", "/order-confirmation", "/login", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
