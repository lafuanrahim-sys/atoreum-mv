import { listAllVouchers, listVoucherEvents } from "@/lib/vouchers/vouchers.server";
import { maskVoucherCode } from "@/lib/vouchers/code";
import PageHeader from "@/components/dashboard/PageHeader";
import { VOUCHERS_ENABLED } from "@/lib/vouchers/feature";
import { notFound } from "next/navigation";

/**
 * Gift vouchers, for the admin.
 *
 * Codes are MASKED here. This page exists to answer "what is outstanding, who
 * bought it, who spent it" — none of which needs the secret. A voucher is a
 * bearer instrument, so a listing that prints codes turns one leaked
 * screenshot into free money; the buyer's own account page is the only place
 * a full code is ever rendered.
 */
const money = (boli: number) => `MVR ${(boli * 0.01).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const STATUS_TONE: Record<string, string> = {
  pending: "text-ivory-dim",
  active: "text-emerald-600",
  exhausted: "text-ivory-dim/70",
  expired: "text-ivory-dim/70",
  void: "text-red-400",
};

export default async function DashboardVouchersPage() {
  if (!VOUCHERS_ENABLED) notFound();

  const vouchers = await listAllVouchers();

  // Money the shop has taken and not yet delivered goods against. Worth seeing
  // as one number: it is a liability, not revenue.
  const outstanding = vouchers
    .filter((v) => v.status === "active")
    .reduce((sum, v) => sum + v.balanceBoli, 0);
  const sold = vouchers
    .filter((v) => v.status !== "pending" && v.status !== "void")
    .reduce((sum, v) => sum + v.faceValueBoli, 0);

  const events = await Promise.all(
    vouchers.slice(0, 10).map(async (v) => ({ voucher: v, events: await listVoucherEvents(v.id) }))
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Inventory"
        title="Gift Vouchers"
        description="Codes are hidden. Only the buyer can see the full code, on their own account page."
      />

      <div className="mt-10 flex flex-col gap-8 border-b border-line pb-8 sm:flex-row sm:divide-x sm:divide-line">
        <div className="sm:pr-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Outstanding</p>
          <p className="mt-2 font-mono text-4xl font-medium text-ivory tabular-nums">{money(outstanding)}</p>
          <p className="mt-1 text-xs text-ivory-dim">unspent credit customers can still redeem</p>
        </div>
        <div className="sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">Sold</p>
          <p className="mt-2 font-mono text-4xl font-medium text-ivory tabular-nums">{money(sold)}</p>
          <p className="mt-1 text-xs text-ivory-dim">{vouchers.length} voucher{vouchers.length === 1 ? "" : "s"} issued</p>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <p className="mt-10 text-sm text-ivory-dim">No gift vouchers have been bought yet.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {["Code", "Buyer", "Order", "Face value", "Balance", "Used", "Status", "Expires"].map((h) => (
                <th key={h} className="py-3 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-ivory-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id} className="border-b border-line">
                <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{maskVoucherCode(v.code)}</td>
                <td className="py-3 pr-4 text-ivory">
                  {v.purchaserName}
                  <span className="block font-mono text-[10px] text-ivory-dim">{v.purchaserEmail}</span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ivory-dim">{v.orderNumber}</td>
                <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">{money(v.faceValueBoli)}</td>
                <td className="py-3 pr-4 font-mono tabular-nums text-ivory">{money(v.balanceBoli)}</td>
                <td className="py-3 pr-4 font-mono tabular-nums text-ivory-dim">
                  {v.redemptions} time{v.redemptions === 1 ? "" : "s"}
                </td>
                <td className={`py-3 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_TONE[v.status]}`}>
                  {v.status}
                </td>
                <td className="py-3 font-mono text-xs text-ivory-dim">
                  {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : "not yet active"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {events.some((e) => e.events.length > 0) && (
        <div className="mt-14">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-ivory-dim">History</h2>
          <div className="mt-4 flex flex-col gap-6">
            {events.filter((e) => e.events.length > 0).map(({ voucher, events: log }) => (
              <div key={voucher.id} className="border-l border-line pl-4">
                <p className="font-mono text-xs text-ivory">{maskVoucherCode(voucher.code)}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {log.map((e, i) => (
                    <li key={i} className="font-mono text-[11px] text-ivory-dim">
                      {new Date(e.createdAt).toLocaleString()} · {e.kind}
                      {e.deltaBoli !== 0 ? ` · ${e.deltaBoli > 0 ? "+" : ""}${money(Math.abs(e.deltaBoli))}` : ""}
                      {/* Who spent it. The whole record of a guest redemption
                          lives here, since there is no account to look up. */}
                      {e.redeemer?.name ? ` · ${e.redeemer.name} <${e.redeemer.email ?? ""}> ${e.redeemer.phone ?? ""}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
