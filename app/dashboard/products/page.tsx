import Link from "next/link";
import { getAllProducts } from "@/lib/data/products.server";
import { deleteProductAction } from "@/app/actions/products";
import StockBadge from "@/components/products/StockBadge";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import Pagination from "@/components/dashboard/Pagination";
import PageHeader from "@/components/dashboard/PageHeader";
import InlineDiscountField from "@/components/dashboard/InlineDiscountField";
import { CATEGORIES } from "@/lib/types";

const PAGE_SIZE = 20;

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function DashboardProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    stock?: string;
    offer?: string;
    featured?: string;
    min?: string;
    max?: string;
    error?: string;
    page?: string;
  }>;
}) {
  const {
    q = "",
    category = "",
    stock = "",
    offer = "",
    featured = "",
    min = "",
    max = "",
    error = "",
    page: pageParam = "1",
  } = await searchParams;
  const all = await getAllProducts();

  // Every column that can usefully narrow the list has a filter, and they
  // compose: all of them are AND-ed, so "Cream + on offer + under MVR 400"
  // is one query. Kept in the URL rather than component state so a filtered
  // view can be bookmarked, shared, and survives the round-trip through a
  // discount save.
  const priceFloor = Number(min);
  const priceCeil = Number(max);
  const filtered = all.filter((p) => {
    const needle = q.trim().toLowerCase();
    // Search covers SKU as well as name -- the SKU is what's on the carton,
    // and searching for it and getting nothing is a confusing dead end.
    const matchesQuery = needle
      ? p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)
      : true;
    const matchesCategory = category ? p.category === category : true;
    const matchesStock = stock ? p.stockStatus === stock : true;
    const matchesOffer = offer === "on" ? p.discountPercent > 0 : offer === "off" ? p.discountPercent === 0 : true;
    const matchesFeatured = featured === "yes" ? p.featured : featured === "no" ? !p.featured : true;
    const matchesFloor = Number.isFinite(priceFloor) && min !== "" ? p.priceEffective >= priceFloor : true;
    const matchesCeil = Number.isFinite(priceCeil) && max !== "" ? p.priceEffective <= priceCeil : true;
    return (
      matchesQuery && matchesCategory && matchesStock && matchesOffer && matchesFeatured && matchesFloor && matchesCeil
    );
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(pageParam) || 1));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const buildHref = (overrides: Record<string, string | number | undefined> = {}) => {
    const params = new URLSearchParams();
    const base: Record<string, string> = { q, category, stock, offer, featured, min, max };
    for (const [k, v] of Object.entries({ ...base, ...overrides })) {
      if (v !== undefined && String(v) !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
  };
  const pageHref = (p: number) => buildHref({ page: p > 1 ? p : undefined });
  // Where a discount save should return to, so the admin keeps their filters
  // and their place in the list.
  const backHref = pageHref(page);

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Products"
        count={all.length}
        actions={
          <Link
            href="/dashboard/products/new"
            className="bg-gold-deep px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            + Add Product
          </Link>
        }
      />

      {error && (
        <p role="alert" className="mt-6 border border-red-400/50 bg-red-400/5 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* A plain GET form: the filters ARE the URL, so no client state, no
          hydration, and the back button behaves. Submitting resets to page 1
          by simply not carrying `page` through. */}
      <form className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-3" method="get">
        <FilterField label="Search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or SKU…"
            className={FILTER_INPUT}
          />
        </FilterField>
        <FilterField label="Category">
          <select name="category" defaultValue={category} className={FILTER_INPUT}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Stock">
          <select name="stock" defaultValue={stock} className={FILTER_INPUT}>
            <option value="">All</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </FilterField>
        <FilterField label="Offer">
          <select name="offer" defaultValue={offer} className={FILTER_INPUT}>
            <option value="">All</option>
            <option value="on">On offer</option>
            <option value="off">Not discounted</option>
          </select>
        </FilterField>
        <FilterField label="Featured">
          <select name="featured" defaultValue={featured} className={FILTER_INPUT}>
            <option value="">All</option>
            <option value="yes">Featured</option>
            <option value="no">Not featured</option>
          </select>
        </FilterField>
        <FilterField label="Price from">
          <input type="number" name="min" defaultValue={min} step="1" min={0} className={`${FILTER_INPUT} w-24`} />
        </FilterField>
        <FilterField label="Price to">
          <input type="number" name="max" defaultValue={max} step="1" min={0} className={`${FILTER_INPUT} w-24`} />
        </FilterField>
        <button
          type="submit"
          className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
        >
          Apply
        </button>
        <Link
          href="/dashboard/products"
          className="px-2 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim/70 hover:text-gold-deep"
        >
          Clear
        </Link>
        <span className="ml-auto font-mono text-[11px] text-ivory-dim">
          {filtered.length === all.length
            ? `${all.length} products`
            : `${filtered.length} of ${all.length} products`}
        </span>
      </form>

      <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ivory text-left">
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Name</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">SKU</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Category</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Minimum</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Price</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Median</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Maximum</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Discount</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">On Hand</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Stock</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Featured</th>
            <th className="py-3"></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => (
            <tr key={p.id} className="border-b border-line">
              <td className="py-3 pr-4 text-ivory">{p.name}</td>
              <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{p.sku}</td>
              <td className="py-3 pr-4 text-ivory-dim">{p.category}</td>
              {/* Floor first, so the price beside it is always read against
                  the number it is not allowed to go under. */}
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim/60">
                {p.priceMin > 0 ? formatPrice(p.priceMin, p.currency) : "—"}
              </td>
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">
                {p.discountPercent > 0 ? (
                  <span className="flex items-baseline gap-2">
                    <s className="text-ivory-dim/50">{formatPrice(p.price, p.currency)}</s>
                    <span className="text-ivory">{formatPrice(p.priceEffective, p.currency)}</span>
                    <span className="font-mono text-[10px] text-gold">-{p.discountPercent}%</span>
                  </span>
                ) : (
                  formatPrice(p.price, p.currency)
                )}
              </td>
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim/60">
                {p.priceMedian !== null ? formatPrice(p.priceMedian, p.currency) : "—"}
              </td>
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim/60">
                {p.priceMax !== null ? formatPrice(p.priceMax, p.currency) : "—"}
              </td>
              <td className="py-3 pr-4">
                <InlineDiscountField
                  productId={p.id}
                  value={p.discountPercent}
                  currency={p.currency}
                  price={p.price}
                  priceEffective={p.priceEffective}
                  back={backHref}
                />
              </td>
              <td
                className={`py-3 pr-4 font-mono tabular-nums ${
                  p.stockOnHand === 0 ? "text-red-400" : "text-ivory"
                }`}
              >
                {p.stockOnHand}
              </td>
              <td className="py-3 pr-4">
                <StockBadge status={p.stockStatus} />
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{p.featured ? "Yes" : "—"}</td>
              <td className="py-3">
                <div className="flex items-center justify-end gap-4">
                  <Link href={`/dashboard/products/${p.id}/edit`} className="font-mono text-xs uppercase tracking-[0.12em] text-gold-deep hover:underline">
                    Edit
                  </Link>
                  <AdminActionButton
                    action={async () => {
                      "use server";
                      await deleteProductAction(p.id);
                    }}
                    label="Delete"
                    pendingLabel="Deleting…"
                    variant="danger"
                    toastMessage={`"${p.name}" deleted.`}
                    confirmTitle="Delete this product?"
                    confirmMessage={`"${p.name}" will be permanently removed from the catalog. This can't be undone.`}
                    confirmLabel="Delete"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-ivory-dim">No products match.</p>
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={pageHref} />
    </div>
  );
}

const FILTER_INPUT =
  "border-b border-line bg-transparent px-1 py-2 font-mono text-xs text-ivory placeholder:text-ivory-dim/70 focus:border-gold-deep focus:outline-none";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim/70">{label}</span>
      {children}
    </label>
  );
}
