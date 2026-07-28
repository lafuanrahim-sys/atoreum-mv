import Link from "next/link";
import { getAllProducts } from "@/lib/data/products.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { listUsers } from "@/lib/data/users.server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import PageHeader from "@/components/dashboard/PageHeader";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

/** Search across products, orders, and customers from one box — spares admins from guessing which section a name/SKU/order # lives in. */
export default async function DashboardSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const [currentUser, allProducts, allOrders, allUsers] = await Promise.all([
    getCurrentUser(),
    query ? getAllProducts() : Promise.resolve([]),
    query ? getAllOrders() : Promise.resolve([]),
    query ? listUsers() : Promise.resolve([]),
  ]);
  const isSuperAdmin = currentUser?.role === "superadmin";

  const products = query
    ? allProducts
        .filter((p) => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query))
        .slice(0, 20)
    : [];

  const orders = query
    ? allOrders
        .filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(query) ||
            o.customer.name.toLowerCase().includes(query) ||
            o.customer.email.toLowerCase().includes(query)
        )
        .slice(0, 20)
    : [];

  const customers = query
    ? allUsers
        .filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
        .slice(0, 20)
    : [];

  const totalResults = products.length + orders.length + customers.length;

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Search" title={q ? `“${q}”` : "Search"} />

      <form className="mt-8 flex gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Search products, orders, customers…"
          className="w-full border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
        />
        <button type="submit" className="shrink-0 border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ivory-dim transition-colors hover:border-gold-deep hover:text-gold-deep">
          Search
        </button>
      </form>

      {!query && <p className="mt-6 text-sm text-ivory-dim">Start typing to search across the whole store.</p>}

      {query && totalResults === 0 && (
        <p className="mt-6 text-sm text-ivory-dim">No results for &ldquo;{q}&rdquo;.</p>
      )}

      {products.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Products — {products.length}</h2>
          <ul className="mt-3 flex flex-col border-t border-line">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/products/${p.id}/edit`}
                  className="flex items-center justify-between border-b border-line py-3 text-sm transition-colors hover:text-gold-deep"
                >
                  <span className="text-ivory group-hover:text-gold-deep">{p.name}</span>
                  <span className="font-mono text-xs tabular-nums text-ivory-dim">
                    {p.sku} · {formatPrice(p.price, p.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Orders — {orders.length}</h2>
          <ul className="mt-3 flex flex-col border-t border-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/orders/${o.id}`}
                  className="flex items-center justify-between border-b border-line py-3 text-sm transition-colors hover:text-gold-deep"
                >
                  <span className="font-mono text-ivory">
                    {o.orderNumber} <span className="font-sans text-ivory-dim">— {o.customer.name}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ivory-dim">{formatPrice(o.subtotal, o.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customers.length > 0 && (
        <section className="mt-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Customers — {customers.length}</h2>
          <ul className="mt-3 flex flex-col border-t border-line">
            {customers.map((u) => (
              <li key={u.id}>
                {isSuperAdmin ? (
                  <Link
                    href="/dashboard/customers"
                    className="flex items-center justify-between border-b border-line py-3 text-sm transition-colors hover:text-gold-deep"
                  >
                    <span className="text-ivory">{u.name}</span>
                    <span className="font-mono text-xs text-ivory-dim">{u.email}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between border-b border-line py-3 text-sm">
                    <span className="text-ivory">{u.name}</span>
                    <span className="font-mono text-xs text-ivory-dim">{u.email}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
