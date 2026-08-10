import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getTodaysPlay, checkDiveEligibility, hasSeenDiveIntro, getStreak } from "@/lib/boli/dive.server";
import { msUntilNextMaleMidnight } from "@/lib/boli/diveEngine";

/**
 * Bootstraps the Sangu Dive UI on mount/reload: today's play if it already
 * happened (so a reload shows the same settled result, never a re-roll —
 * BOLI_SPEC.md §6.4), eligibility, streak state, and the intro-card flag.
 * Never rolls anything — see POST /api/boli/dive/play for that.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [play, eligibility, hasSeenIntro, streak] = await Promise.all([
      getTodaysPlay(user.id),
      checkDiveEligibility({ userId: user.id, email: user.email }),
      hasSeenDiveIntro(user.id),
      getStreak(user.id),
    ]);

    return NextResponse.json(
      {
        loggedIn: true,
        eligible: eligibility.eligible,
        ineligibleReason: eligibility.eligible ? null : eligibility.reason,
        play,
        hasSeenIntro,
        streak,
        msUntilNextMaleMidnight: msUntilNextMaleMidnight(new Date()),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[boli] /api/boli/dive/today failed:", err);
    return NextResponse.json(
      { loggedIn: true, eligible: false, ineligibleReason: "Sangu Dive isn't available right now. Check back soon.", play: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
