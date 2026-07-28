import Link from "next/link";
import { getAllProducts } from "@/lib/data/products.server";
import { deleteProductAction } from "@/app/actions/products";
import StockBadge from "@/components/products/StockBadge";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import Pagination from "@/components/dashboard/Pagination";
import PageHeader from "@/components/dashboard/PageHeader";

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

      <form className="mt-8 flex gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory placeholder:text-ivory-dim/70 focus:border-gold-deep focus:outline-none"
        />
        <button
          type="submit"
          className="border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep"
        >
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ivory text-left">
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Name</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">SKU</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Category</th>
            <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Price</th>
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
              <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">{formatPrice(p.price, p.currency)}</td>
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
