import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { getAllProducts } from "@/lib/data/products.server";
import { logoutAction } from "@/app/actions/auth";
import ProfileForms from "@/components/account/ProfileForms";
import ProductCard from "@/components/products/ProductCard";
import BoliSection, { type PendingBoliOrder } from "@/components/account/BoliSection";
import BoliDiveGame from "@/components/boli/BoliDiveGame";
import { dismissDiveIntroAction, replayDiveTestAction } from "@/app/actions/boliDive";
import { isAdminRole } from "@/lib/auth/userSession";
import { getBalance, listLedger, getExpiringSoon, estimatePurchaseEarn } from "@/lib/boli/ledger.server";
import { EXPIRY_WARNING_WINDOW_DAYS, UNLIMITED_DIVE_PLAYS_FOR_ADMINS } from "@/lib/boli/config";

export const metadata: Metadata = {
  title: "My Account — Atoreum MV",
  description: "Your orders, favorites, and profile.",
};

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const STATUS_STYLES: Record<string, string> = {
  "Pending Verification": "text-gold",
  Confirmed: "text-sand",
  Shipped: "text-ivory-dim",
  Completed: "text-emerald-500 font-semibold",
  Cancelled: "text-red-400",
};

const TABS = [
  { key: "orders", label: "My Orders" },
  { key: "favorites", label: "Favorites" },
  { key: "boli", label: "Boli" },
  { key: "profile", label: "Profile" },
] as const;

const BOLI_PAGE_SIZE = 20;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; profile?: string; password?: string; boliPage?: string; boliView?: string }>;
}) {
  const { tab = "orders", profile = "", password = "", boliPage: boliPageRaw = "1", boliView = "my" } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=%2Faccount");

  // userId (set at checkout from the session) is the authoritative link —
  // it survives the shipping-form email differing from the account's login
  // email. Falls back to email match for orders placed before userId
  // existed, or by a guest checkout later claimed by this account's email.
  const [allOrders, allProducts] = await Promise.all([getAllOrders(), getAllProducts()]);
  const myOrders = allOrders.filter(
    (o) => o.userId === user.id || o.customer.email.toLowerCase() === user.email.toLowerCase()
  );
  const favoriteProducts = allProducts.filter((p) => user.favorites.includes(p.id));

  // Fetched only when the Boli tab is active (or an error is hit) — no
  // point calling out to Supabase on every account-page load. Boli not
  // being provisioned yet must never break the rest of the account page.
  let boliData: {
    displayBalance: number;
    lifetimeEarned: number;
    tier: "faru" | "vilu" | "kandu" | "thari";
    underReview: boolean;
    pendingOrders: PendingBoliOrder[];
    expiringSoon: number;
    ledger: Awaited<ReturnType<typeof listLedger>>["entries"];
    page: number;
    hasMore: boolean;
  } | null = null;
  let boliError = false;

  if (tab === "boli" && boliView !== "dive") {
    try {
      const page = Math.max(1, Number(boliPageRaw) || 1);
      const snapshot = await getBalance(user.id);
      const [{ entries, hasMore }, expiringSoon] = await Promise.all([
        listLedger(user.id, { limit: BOLI_PAGE_SIZE, offset: (page - 1) * BOLI_PAGE_SIZE }),
        getExpiringSoon(user.id, EXPIRY_WARNING_WINDOW_DAYS),
      ]);
      const pendingOrders: PendingBoliOrder[] = myOrders
        .filter((o) => o.status !== "Completed" && o.status !== "Cancelled")
        .map((o) => ({
          orderId: o.id,
          orderNumber: o.orderNumber,
          estimatedBoli: estimatePurchaseEarn(o.subtotal, o.boliDiscountAmount ?? 0, snapshot.tier),
          placedAt: o.createdAt,
        }))
        .filter((o) => o.estimatedBoli > 0);

      boliData = {
        displayBalance: Number(snapshot.displayBalance),
        lifetimeEarned: Number(snapshot.lifetimeEarned),
        tier: snapshot.tier,
        underReview: snapshot.trueBalance < 0,
        pendingOrders,
        expiringSoon: Number(expiringSoon),
        ledger: entries,
        page,
        hasMore,
      };
    } catch (err) {
      console.error("[boli] account page lookup failed:", err);
      boliError = true;
    }
  }

  return (
    <div className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">My Account</p>
            <h1 className="mt-3 font-display text-3xl text-ivory md:text-4xl">
              Hello, {user.name.split(" ")[0]}.
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {(user.role === "admin" || user.role === "superadmin") && (
              <Link
                href="/dashboard"
                className="text-xs uppercase tracking-[0.2em] text-gold hover:underline"
              >
                Go to Dashboard →
              </Link>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:text-gold"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <nav className="mt-10 flex gap-1 border-b border-line text-xs uppercase tracking-[0.2em]">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/account?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`px-4 pb-3 transition-colors ${
                tab === t.key ? "border-b border-gold text-gold" : "text-ivory-dim hover:text-gold"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="mt-10">
          {tab === "orders" && (
            <div>
              {myOrders.length === 0 ? (
                <div className="flex flex-col items-start gap-4">
                  <p className="text-sm text-ivory-dim">
                    No orders yet — your order history will appear here.
                  </p>
                  <Link
                    href="/products"
                    className="border border-gold px-6 py-3 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold-deep hover:text-ink"
                  >
                    Browse the Collection
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-6">
                  {myOrders.map((order) => (
                    <li key={order.id} className="border border-line p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-ivory">{order.orderNumber}</p>
                          <p className="mt-1 text-xs text-ivory-dim">
                            Placed {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <span
                            className={`text-xs uppercase tracking-[0.15em] ${STATUS_STYLES[order.status] ?? "text-ivory-dim"}`}
                          >
                            {order.status}
                          </span>
                          <span className="text-sm text-ivory tabular-nums">
                            {formatPrice(order.subtotal, order.currency)}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                        {order.items.map((item) => (
                          <li key={item.productId} className="flex justify-between text-sm">
                            <span className="text-ivory-dim">
                              {item.name} <span className="text-ivory-dim/60">× {item.quantity}</span>
                            </span>
                            <span className="text-ivory-dim tabular-nums">
                              {formatPrice(item.price * item.quantity, item.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "favorites" && (
            <div>
              {favoriteProducts.length === 0 ? (
                <div className="flex flex-col items-start gap-4">
                  <p className="text-sm text-ivory-dim">
                    Nothing saved yet — tap the heart on any product to keep it here.
                  </p>
                  <Link
                    href="/products"
                    className="border border-gold px-6 py-3 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold-deep hover:text-ink"
                  >
                    Browse the Collection
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                  {favoriteProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "boli" && (
            <div>
              <nav className="mb-8 flex gap-6 text-xs uppercase tracking-[0.2em]">
                <Link
                  href="/account?tab=boli&boliView=my"
                  aria-current={boliView !== "dive" ? "page" : undefined}
                  className={boliView !== "dive" ? "text-gold" : "text-ivory-dim hover:text-gold"}
                >
                  My Boli
                </Link>
                <Link
                  href="/account?tab=boli&boliView=dive"
                  aria-current={boliView === "dive" ? "page" : undefined}
                  className={boliView === "dive" ? "text-gold" : "text-ivory-dim hover:text-gold"}
                >
                  Boli Dive
                </Link>
              </nav>

              {boliView === "dive" ? (
                <BoliDiveGame
                  dismissIntroAction={dismissDiveIntroAction}
                  canReplayForTesting={UNLIMITED_DIVE_PLAYS_FOR_ADMINS && isAdminRole(user.role)}
                  replayAction={replayDiveTestAction}
                />
              ) : (
                <>
                  {boliError && (
                    <p className="text-sm text-ivory-dim">
                      Boli isn&apos;t available right now — please check back shortly.
                    </p>
                  )}
                  {boliData && <BoliSection {...boliData} />}
                </>
              )}
            </div>
          )}

          {tab === "profile" && (
            <ProfileForms
              user={user}
              back="/account?tab=profile"
              flags={{ profile, password }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
