import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { listUsers } from "@/lib/data/users.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { assignRoleAction, deleteUserAction } from "@/app/actions/auth";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString("en-US")}`;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  customer: "Customer",
};

export default async function DashboardCustomersPage() {
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

  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Customers ({users.length})</h1>
      <p className="mt-1 text-sm text-ivory-dim">
        Registered accounts and their order history.
        {isSuperAdmin
          ? " As super admin you can grant or revoke admin access and delete accounts."
          : " Only the super admin can manage roles or delete accounts."}
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-ink">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ivory-dim">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Total Spend</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const stats = statsFor(u.email);
              const isSelf = me?.id === u.id;
              const isTargetSuperAdmin = u.role === "superadmin";
              const canManage = isSuperAdmin && !isSelf && !isTargetSuperAdmin;
              return (
                <tr key={u.id} className="border-b border-line/50 last:border-b-0">
                  <td className="px-5 py-3 text-ivory">
                    {u.name}
                    {isSelf && <span className="ml-2 text-[10px] uppercase text-ivory-dim">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-ivory-dim">{u.email}</td>
                  <td className="px-5 py-3 text-ivory-dim">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-ivory-dim tabular-nums">{stats.count}</td>
                  <td className="px-5 py-3 text-ivory-dim tabular-nums">
                    {formatPrice(stats.spend, stats.currency)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs uppercase tracking-[0.12em] ${
                        isTargetSuperAdmin
                          ? "text-gold-deep font-semibold"
                          : u.role === "admin"
                            ? "text-gold"
                            : "text-ivory-dim"
                      }`}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-4">
                        <form
                          action={async () => {
                            "use server";
                            await assignRoleAction(u.id, u.role === "admin" ? "customer" : "admin");
                          }}
                          className="inline"
                        >
                          <button type="submit" className="text-xs text-gold hover:underline">
                            {u.role === "admin" ? "Revoke admin" : "Make admin"}
                          </button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await deleteUserAction(u.id);
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="text-xs text-ivory-dim transition-colors hover:text-red-500"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-ivory-dim/70">
        Guest checkout orders (placed without an account) appear under Orders but not here.
        Deleting an account does not delete its past orders.
      </p>
    </div>
  );
}
