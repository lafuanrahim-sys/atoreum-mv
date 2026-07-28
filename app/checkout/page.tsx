import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings.server";
import CheckoutClient from "@/components/checkout/CheckoutClient";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getBalance } from "@/lib/boli/ledger.server";
import { MIN_REDEMPTION_BOLI } from "@/lib/boli/config";

export const metadata: Metadata = {
  title: "Checkout — Atoreum MV",
};

/**
 * Server shell: reads the store's bank-transfer settings (editable in
 * Dashboard → Settings) and hands them to the interactive checkout flow.
 * Also resolves the signed-in user's Boli eligibility here — guests and
 * accounts with no delivered order never see the redemption widget at all,
 * matching the server-side-only enforcement in app/actions/checkout.ts and
 * lib/boli/schema.sql (this is a UX convenience, not the actual gate).
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();
  let boli: { available: number; eligible: boolean; ineligibleReason: string | null } | null = null;

  if (user) {
    try {
      const snapshot = await getBalance(user.id);
      const available = Number(snapshot.displayBalance);
      const eligible = snapshot.hasDeliveredOrder && !snapshot.gameAccessSuspended && snapshot.trueBalance >= BigInt(0) && available >= MIN_REDEMPTION_BOLI;
      let ineligibleReason: string | null = null;
      if (!eligible) {
        if (snapshot.trueBalance < 0) ineligibleReason = "Your Boli balance is under review.";
        else if (!snapshot.hasDeliveredOrder) ineligibleReason = "Boli can be redeemed once you have a completed order.";
        else if (available < MIN_REDEMPTION_BOLI) ineligibleReason = `You need at least ${MIN_REDEMPTION_BOLI.toLocaleString()} Boli to redeem.`;
      }
      boli = { available, eligible, ineligibleReason };
    } catch (err) {
      // Boli not provisioned yet (e.g. Supabase env vars unset) — checkout
      // must keep working with the redemption widget simply absent.
      console.error("[boli] checkout balance lookup failed:", err);
    }
  }

  return (
    <CheckoutClient
      bankDetails={await getSettings()}
      boli={boli}
      defaultContact={user ? { name: user.name, email: user.email } : null}
    />
  );
}
