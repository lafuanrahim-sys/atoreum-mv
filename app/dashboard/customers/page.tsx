import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { listUsers } from "@/lib/data/users.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { assignRoleAction, deleteUserAction } from "@/app/actions/auth";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import Pagination from "@/components/dashboard/Pagination";
import SortHeader from "@/components/dashboard/SortHeader";
import PageHeader from "@/components/dashboard/PageHeader";

const PAGE_SIZE = 20;

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  customer: "Customer",
};

export default async function DashboardCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { page: pageParam = "1", sort = "joined-desc" } = await searchParams;
  const me = await getCurrentUser();
  const isSuperAdmin = me?.role === "superadmin";
  const users = listUsers();
  const orders = getAllOrders();

  const statsFor = (email: string) => {
    const theirs = orders.filter(
      (o) => o.customer.email.toLowerCase() === email.toLowerCase() && o.status !== "Cancelled"
    );
    return {
      count: theirs.length,
      spend: theirs.reduce((sum, o) => sum + o.subtotal, 0),
      currency: theirs[0]?.currency ?? "MVR",
    };
  };

  const withStats = users.map((u) => ({ user: u, stats: statsFor(u.email) }));

  const [sortKey, sortDir] = sort.split("-");
  const dir = sortDir === "asc" ? 1 : -1;
  withStats.sort((a, b) => {
    if (sortKey === "spend") return (a.stats.spend - b.stats.spend) * dir;
    // default: joined date
    return (new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime()) * dir;
  });

  const pageCount = Math.max(1, Math.ceil(withStats.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(pageParam) || 1));
  const paged = withStats.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefFor = (opts: { page?: number; sort?: string }) => {
    const params = new URLSearchParams();
    const nextSort = opts.sort ?? sort;
    const nextPage = opts.page ?? page;
    if (nextSort !== "joined-desc") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/dashboard/customers?${qs}` : "/dashboard/customers";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Customers"
        count={users.length}
        description={
          isSuperAdmin
            ? "As super admin you can grant or revoke admin access and delete accounts."
            : "Only the super admin can manage roles or delete accounts."
        }
      />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ivory text-left">
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Name</th>
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Email</th>
              <SortHeader
                label="Joined"
                sortKey="joined"
                activeSort={sort}
                hrefFor={(s) => hrefFor({ sort: s, page: 1 })}
              />
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Orders</th>
              <SortHeader
                label="Total Spend"
                sortKey="spend"
                activeSort={sort}
                hrefFor={(s) => hrefFor({ sort: s, page: 1 })}
              />
              <th className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">Role</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(({ user: u, stats }) => {
              const isSelf = me?.id === u.id;
              const isTargetSuperAdmin = u.role === "superadmin";
              const canManage = isSuperAdmin && !isSelf && !isTargetSuperAdmin;
              return (
                <tr key={u.id} className="border-b border-line">
                  <td className="py-3 pr-4 text-ivory">
                    {u.name}
                    {isSelf && <span className="ml-2 font-mono text-[10px] uppercase text-ivory-dim">(you)</span>}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{u.email}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">{stats.count}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">
                    {formatPrice(stats.spend, stats.currency)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                        isTargetSuperAdmin
                          ? "text-gold-deep"
                          : u.role === "admin"
                            ? "text-gold-deep"
                            : "text-ivory-dim"
                      }`}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-4">
                        <AdminActionButton
                          action={async () => {
                            "use server";
                            await assignRoleAction(u.id, u.role === "admin" ? "customer" : "admin");
                          }}
                          label={u.role === "admin" ? "Revoke admin" : "Make admin"}
                          pendingLabel="Updating…"
                          toastMessage={
                            u.role === "admin" ? `${u.name} is no longer an admin.` : `${u.name} is now an admin.`
                          }
                          confirmTitle={u.role === "admin" ? "Revoke admin access?" : "Grant admin access?"}
                          confirmMessage={
                            u.role === "admin"
                              ? `${u.name} will lose access to the admin dashboard.`
                              : `${u.name} will be able to manage products, orders, and other admin data.`
                          }
                          confirmLabel={u.role === "admin" ? "Revoke" : "Grant access"}
                        />
                        <AdminActionButton
                          action={async () => {
                            "use server";
                            await deleteUserAction(u.id);
                          }}
                          label="Delete"
                          pendingLabel="Deleting…"
                          variant="danger"
                          toastMessage={`${u.name}'s account deleted.`}
                          confirmTitle="Delete this account?"
                          confirmMessage={`${u.name}'s account will be permanently deleted. Their past orders remain, but they can no longer sign in.`}
                          confirmLabel="Delete"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => hrefFor({ page: p })} />

      <p className="mt-6 font-mono text-[11px] text-ivory-dim/70">
        Guest checkout orders (placed without an account) appear under Orders but not here.
        Deleting an account does not delete its past orders.
      </p>
    </div>
  );
}
