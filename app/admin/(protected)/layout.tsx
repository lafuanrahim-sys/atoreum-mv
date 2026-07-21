import Link from "next/link";
import { logout } from "@/app/actions/adminAuth";

/**
 * Deliberately plain/functional — this is an internal tool, not a customer-
 * facing surface, so it borrows the site's color tokens for consistency but
 * skips the marketing-site polish (motion, decorative type, etc).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-2">
      <header className="flex items-center justify-between border-b border-line bg-ink px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-display text-sm uppercase tracking-[0.2em] text-ivory">
            Atoreum Admin
          </span>
          <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.15em]">
            <Link href="/admin/products" className="text-ivory-dim hover:text-gold">
              Products
            </Link>
            <Link href="/admin/orders" className="text-ivory-dim hover:text-gold">
              Orders
            </Link>
          </nav>
        </div>
        <form action={logout}>
          <button type="submit" className="text-xs uppercase tracking-[0.15em] text-ivory-dim hover:text-gold">
            Log out
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-10">{children}</main>
    </div>
  );
}
