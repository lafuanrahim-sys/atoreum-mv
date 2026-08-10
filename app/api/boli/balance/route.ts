import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getBalance } from "@/lib/boli/ledger.server";

/**
 * Lightweight balance probe for the header chip (components/layout/BoliChip.tsx)
 * — separate from /api/me so the base session check (used on every page,
 * via SessionContext) never pays for a Supabase round-trip it doesn't need.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const snapshot = await getBalance(user.id);
    return NextResponse.json(
      { loggedIn: true, balance: Number(snapshot.displayBalance) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    // Sangu not provisioned yet — chip simply doesn't render rather than erroring.
    console.error("[boli] /api/boli/balance failed:", err);
    return NextResponse.json({ loggedIn: true, balance: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
