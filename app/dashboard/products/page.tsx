import Link from "next/link";
import { getAllProducts } from "@/lib/data/products.server";
import { deleteProductAction } from "@/app/actions/products";

const PAGE_SIZE = 20;

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

export default async function DashboardProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q = "", category = "", page: pageParam = "1" } = await searchParams;
  const all = getAllProducts();

  const filtered = all.filter((p) => {
    const matchesQuery = q ? p.name.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesCategory = category ? p.category === category : true;
    return matchesQuery && matchesCategory;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(pageParam) || 1));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ivory">Products ({all.length})</h1>
        <Link
          href="/dashboard/products/new"
          className="bg-gold-deep px-5 py-2 text-xs uppercase tracking-[0.15em] text-ink hover:bg-gold-deep/90"
        >
          + Add Product
        </Link>
      </div>

      <form className="mt-6 flex gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="border border-line bg-transparent px-3 py-2 text-sm text-ivory"
        />
        <button type="submit" className="border border-line px-4 py-2 text-xs uppercase tracking-wide text-ivory-dim hover:text-gold">
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-ink">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ivory-dim">
            <th className="py-3 pr-4">Name</th>
            <th className="py-3 pr-4">SKU</th>
            <th className="py-3 pr-4">Category</th>
            <th className="py-3 pr-4">Price</th>
            <th className="py-3 pr-4">On Hand</th>
            <th className="py-3 pr-4">Stock</th>
            <th className="py-3 pr-4">Featured</th>
            <th className="py-3 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => (
            <tr key={p.id} className="border-b border-line/50">
              <td className="py-3 pr-4 text-ivory">{p.name}</td>
              <td className="py-3 pr-4 text-ivory-dim">{p.sku}</td>
              <td className="py-3 pr-4 text-ivory-dim">{p.category}</td>
              <td className="py-3 pr-4 text-ivory-dim tabular-nums">{formatPrice(p.price, p.currency)}</td>
              <td
                className={`py-3 pr-4 tabular-nums ${
                  p.stockOnHand === 0 ? "text-red-400" : "text-ivory"
                }`}
              >
                {p.stockOnHand}
              </td>
              <td className="py-3 pr-4 text-ivory-dim">{p.stockStatus}</td>
              <td className="py-3 pr-4 text-ivory-dim">{p.featured ? "Yes" : ""}</td>
              <td className="py-3 pr-4 text-right">
                <Link href={`/dashboard/products/${p.id}/edit`} className="text-gold hover:underline">
                  Edit
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deleteProductAction(p.id);
                  }}
                  className="inline"
                >
                  <button type="submit" className="ml-4 text-ivory-dim hover:text-red-400">
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-ivory-dim">No products match.</p>
      )}

      {filtered.length > 0 && pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-6">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="border border-line px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:border-gold hover:text-gold"
            >
              Prev
            </Link>
          ) : (
            <span className="cursor-not-allowed border border-line px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-ivory-dim opacity-30">
              Prev
            </span>
          )}
          <span className="text-xs tracking-[0.15em] text-ivory-dim">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              className="border border-line px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:border-gold hover:text-gold"
            >
              Next
            </Link>
          ) : (
            <span className="cursor-not-allowed border border-line px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-ivory-dim opacity-30">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  );
}
