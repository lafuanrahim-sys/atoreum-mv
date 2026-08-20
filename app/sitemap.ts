import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/data/products.server";
import { absoluteUrl } from "@/lib/site";

/**
 * Every public page, so Google doesn't have to find 87 product pages by
 * following links from the collection grid — which it may never fully do for
 * a new site with no inbound links pointing at it.
 *
 * lastModified comes from the product's own updatedAt rather than "now".
 * Stamping every URL with the build time tells a crawler the whole catalogue
 * changed on every deploy, which is false, and a source that cries wolf gets
 * its dates ignored. A real date on the handful of products that actually
 * changed is worth more than a fresh one on all of them.
 *
 * Deliberately absent: /checkout, /account, /login, /order-confirmation,
 * /dashboard, /fx, /invoice. Nothing personal or staff-only belongs in a
 * document meant to invite crawling (see app/robots.ts).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * A sitemap without the catalogue is worth having; a build without a
   * deployment is not.
   *
   * This runs at build time and reads the database, so an environment without
   * DATABASE_URL -- a preview deployment, a fork, a CI job with no secrets --
   * failed the ENTIRE build here, on the one route that could most afford to
   * degrade. The static pages below need no database at all.
   *
   * Failing loudly in the log and quietly in the output is the right shape:
   * a production build that lost its database is a real problem someone must
   * see, and it is still not a reason to ship nothing.
   */
  let products: Awaited<ReturnType<typeof getAllProducts>> = [];
  try {
    products = await getAllProducts();
  } catch (err) {
    console.error(
      "[sitemap] could not read products; emitting the static pages only:",
      err instanceof Error ? err.message : err
    );
  }

  // The newest product edit stands in for "when did the shop last change" on
  // the pages that list products but have no timestamp of their own.
  const catalogueTouched = products.reduce<Date>((latest, p) => {
    const updated = new Date(p.updatedAt);
    return Number.isNaN(updated.getTime()) || updated < latest ? latest : updated;
  }, new Date(0));
  const catalogueLastModified = catalogueTouched.getTime() > 0 ? catalogueTouched : new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: catalogueLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/products"),
      lastModified: catalogueLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/about"),
      lastModified: catalogueLastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/contact"),
      lastModified: catalogueLastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/terms/boli"),
      lastModified: catalogueLastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.id}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      // Above the about/contact pages: a product page is what someone
      // searching for "lebelage snail cream maldives" should land on.
      priority: 0.8,
    })),
  ];
}
