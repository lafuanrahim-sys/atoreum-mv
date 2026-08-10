import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import AdminActionButton from "@/components/dashboard/AdminActionButton";
import BoliRuntimeToggles from "@/components/dashboard/BoliRuntimeToggles";
import { getBoliOverview, getTopGameEarners, getOpenFraudFlags, getBoliAlerts } from "@/lib/boli/adminStats.server";
import { listRuntimeConfig } from "@/lib/boli/runtimeConfig.server";
import { resolveFraudFlagAction } from "@/app/actions/boliAdmin";
import { BOLI_TO_MVR } from "@/lib/boli/config";

function formatSangu(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function formatMvr(n: number) {
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FLAG_LABEL: Record<string, string> = {
  device_collision: "Shared device",
  ip_collision: "Shared IP",
  refund_pattern: "Refund pattern",
  manual: "Manual",
};

export default async function DashboardBoliPage() {
  let overview: Awaited<ReturnType<typeof getBoliOverview>> | null = null;
  let topEarners: Awaited<ReturnType<typeof getTopGameEarners>> = [];
  let fraudFlags: Awaited<ReturnType<typeof getOpenFraudFlags>> = [];
  let alerts: Awaited<ReturnType<typeof getBoliAlerts>> = [];
  let runtimeConfig: Awaited<ReturnType<typeof listRuntimeConfig>> = [];
  let loadError = false;

  try {
    [overview, topEarners, fraudFlags, alerts, runtimeConfig] = await Promise.all([
      getBoliOverview(),
      getTopGameEarners(20),
      getOpenFraudFlags(),
      getBoliAlerts(),
      listRuntimeConfig(),
    ]);
  } catch (err) {
    console.error("[boli] admin dashboard load failed:", err);
    loadError = true;
  }

  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="Loyalty" title="Sangu" description="Currency liability, Sangu Dive spend, and fraud review." />

      {loadError && (
        <p className="mt-8 text-sm text-ivory-dim">Sangu data isn&apos;t available right now. Please check back shortly.</p>
      )}

      {!loadError && overview && (
        <>
          {alerts.length > 0 && (
            <ul className="mt-8 flex flex-col gap-2">
              {alerts.map((alert, i) => (
                <li
                  key={i}
                  className={`border px-4 py-3 text-sm ${
                    alert.severity === "critical" ? "border-red-500/50 bg-red-500/5 text-ivory" : "border-gold/40 bg-gold/5 text-ivory"
                  }`}
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 border border-line p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sand">Outstanding liability</p>
            <p className="mt-2 font-display text-4xl text-ivory tabular-nums">{formatSangu(overview.circulating)} Sangu</p>
            <p className="mt-1 text-sm text-ivory-dim">{formatMvr(overview.circulatingMvr)} at {BOLI_TO_MVR} MVR/Sangu</p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Issued this week" value={`${formatSangu(overview.issuanceThisWeek.purchase + overview.issuanceThisWeek.game)}`} sub={`${formatSangu(overview.issuanceThisWeek.purchase)} purchase · ${formatSangu(overview.issuanceThisWeek.game)} game`} />
            <Stat label="Issued this month" value={`${formatSangu(overview.issuanceThisMonth.purchase + overview.issuanceThisMonth.game)}`} sub={`${formatSangu(overview.issuanceThisMonth.purchase)} purchase · ${formatSangu(overview.issuanceThisMonth.game)} game`} />
            <Stat label="Redeemed this month" value={formatSangu(overview.redemptionThisMonth)} sub={`${overview.redemptionRateThisMonth.toFixed(1)}% of issuance`} />
            <Stat label="Breakage (expired)" value={formatSangu(overview.totalEverExpired)} sub="Never redeemed, all-time" />
          </div>

          <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Live Controls</h2>
          <div className="mt-4">
            <BoliRuntimeToggles rows={runtimeConfig} />
          </div>

          <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
            Top Game Earners ({topEarners.length})
          </h2>
          {topEarners.length === 0 ? (
            <p className="mt-3 text-sm text-ivory-dim">No Sangu Dive activity yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Game Sangu</th>
                    <th className="py-2 pr-4">Device collisions</th>
                  </tr>
                </thead>
                <tbody>
                  {topEarners.map((earner) => (
                    <tr key={earner.userId} className="border-b border-line/60">
                      <td className="py-3 pr-4">
                        <p className="text-ivory">{earner.name}</p>
                        <p className="text-xs text-ivory-dim">{earner.email}</p>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-ivory">{formatSangu(earner.gameSangu)}</td>
                      <td className={`py-3 pr-4 tabular-nums ${earner.deviceCollisionCount >= 5 ? "text-red-400" : "text-ivory-dim"}`}>
                        {earner.deviceCollisionCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">
            Fraud Review Queue ({fraudFlags.length})
          </h2>
          {fraudFlags.length === 0 ? (
            <p className="mt-3 text-sm text-ivory-dim">Nothing waiting for review.</p>
          ) : (
            <ul className="mt-4 flex flex-col border-t border-line">
              {fraudFlags.map((flag) => (
                <li key={flag.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
                  <div>
                    <p className="text-sm text-ivory">
                      <span className="text-gold-deep">{FLAG_LABEL[flag.flagType] ?? flag.flagType}</span>: {flag.userName}{" "}
                      <span className="text-ivory-dim">({flag.userEmail})</span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-ivory-dim">
                      {new Date(flag.createdAt).toLocaleString()} · {JSON.stringify(flag.detail)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <AdminActionButton
                      action={async () => {
                        "use server";
                        await resolveFraudFlagAction(flag.id, "resolved");
                      }}
                      label="Resolve"
                      pendingLabel="Resolving…"
                      variant="primary"
                      toastMessage="Flag resolved."
                    />
                    <AdminActionButton
                      action={async () => {
                        "use server";
                        await resolveFraudFlagAction(flag.id, "dismissed");
                      }}
                      label="Dismiss"
                      pendingLabel="Dismissing…"
                      variant="default"
                      toastMessage="Flag dismissed."
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-14 text-sm text-ivory-dim">
            Adding or removing Sangu for a customer now lives on their own page, alongside their orders and ledger.{" "}
            <Link href="/dashboard/customers" className="text-gold-deep hover:underline">
              Go to Customers →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border border-line p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{label}</p>
      <p className="mt-2 text-xl text-ivory tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ivory-dim">{sub}</p>
    </div>
  );
}
