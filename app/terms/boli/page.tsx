import type { Metadata } from "next";
import {
  PURCHASE_EARN_BOLI,
  PURCHASE_EARN_PER_MVR,
  REDEMPTION_BOLI_PER_MVR,
  MIN_REDEMPTION_BOLI,
  MAX_REDEMPTION_SUBTOTAL_FRACTION,
  GAME_BOLI_EXPIRY_DAYS,
  PURCHASE_BOLI_EXPIRY_DAYS,
} from "@/lib/boli/config";

export const metadata: Metadata = {
  title: "Boli Terms — Atoreum MV",
  description: "Terms governing Boli, Atoreum MV's in-store loyalty currency.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What Boli is",
    body: `Boli is Atoreum MV's in-store loyalty currency, named for the cowrie shell — a historical Maldivian trade currency. Boli has no cash value, cannot be bought, sold, exchanged for cash, or transferred between accounts. It exists only to be earned and redeemed within the Atoreum MV store.`,
  },
  {
    title: "Earning Boli",
    body: `You earn ${PURCHASE_EARN_BOLI} Boli for every MVR ${PURCHASE_EARN_PER_MVR} of an order's subtotal (excluding shipping and any Boli discount already applied to that order). Boli from a purchase is credited once the order is completed — not at checkout — and shows as "Pending" until then. Boli can also be earned by playing Boli Dive, our daily in-store game, where offered.`,
  },
  {
    title: "Redeeming Boli",
    body: `${REDEMPTION_BOLI_PER_MVR} Boli = MVR 1 off an order. Redemption requires a minimum of ${MIN_REDEMPTION_BOLI.toLocaleString()} Boli and is capped at ${Math.round(MAX_REDEMPTION_SUBTOTAL_FRACTION * 100)}% of that order's subtotal. Redemption is only available to accounts with at least one completed order — this applies regardless of your Boli balance.`,
  },
  {
    title: "Expiry",
    body: `Boli earned from purchases expires ${PURCHASE_BOLI_EXPIRY_DAYS} days after it's credited. Boli earned from Boli Dive expires ${GAME_BOLI_EXPIRY_DAYS} days after it's credited. We'll show a warning in your account when Boli is close to expiring.`,
  },
  {
    title: "Refunds and cancellations",
    body: `If an order that earned Boli is later cancelled or refunded, the Boli it earned is removed from your balance. If that order also redeemed Boli, the redeemed Boli is returned to your balance. If removing earned Boli would take your balance below zero, your account is placed under review and redemption is paused until it's resolved — please contact us if this happens to you.`,
  },
  {
    title: "Fair use",
    body: `Boli is intended for genuine shoppers. We may suspend Boli Dive access, delay crediting, or void Boli balances obtained through multiple accounts, automated play, or other abuse of the programme, at our discretion and without prior notice where fraud is reasonably suspected.`,
  },
  {
    title: "Changes to this programme",
    body: `We may modify or end the Boli programme at any time, with at least 30 days' notice for material changes that reduce its value to you. Rates, caps, and thresholds shown in-app may be adjusted from time to time as the programme is tuned.`,
  },
];

export default function BoliTermsPage() {
  return (
    <div className="page-gutter bg-ink pt-10 pb-28 md:pt-14">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Boli</p>
        <h1 className="mt-6 font-display text-3xl text-ivory md:text-4xl">Terms</h1>
        <p className="mt-4 text-sm text-ivory-dim">
          These terms govern Boli, Atoreum MV&apos;s in-store loyalty currency. They sit alongside — not in place
          of — our general store terms.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="border border-line p-8">
              <h2 className="font-display text-lg text-ivory">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
