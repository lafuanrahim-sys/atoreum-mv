import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { playToday, parsePickedIndices } from "@/lib/boli/dive.server";
import { checkPlayRateLimit } from "@/lib/boli/rateLimit";

function clientIp(request: NextRequest): string {
  // No CDN/reverse-proxy of record for this deployment — best-effort only,
  // and never used to hard-block (BOLI_SPEC.md §6.1 item 5), only to rate
  // limit and, downstream, to flag for review.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Deals (or resumes) today's Boli Dive board and resolves the player's
 * pick. The client sends only which 3 balls it chose (positions, nothing
 * about their values — it can't know those) and a device hash it computed
 * locally — never a tier or an amount (BOLI_SPEC.md §6.4: "the server
 * rolls the outcome"). See lib/boli/dive.server.ts for the actual deal +
 * the atomic, idempotent database call.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to play Boli Dive." }, { status: 401 });
  }

  const ip = clientIp(request);
  const rateLimit = checkPlayRateLimit(user.id, ip);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests — try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let deviceHash: string | null = null;
  let pickedIndices: number[] | null = null;
  try {
    const body = await request.json();
    if (typeof body?.deviceHash === "string" && body.deviceHash.length > 0 && body.deviceHash.length <= 128) {
      deviceHash = body.deviceHash;
    }
    pickedIndices = parsePickedIndices(body?.pickedIndices);
  } catch {
    // No/invalid body — pickedIndices stays null, caught below.
  }
  if (pickedIndices === null) {
    return NextResponse.json({ ok: false, error: "Invalid pick." }, { status: 400 });
  }

  const ipHash = ip === "unknown" ? null : crypto.createHash("sha256").update(ip).digest("hex");

  try {
    const result = await playToday({ userId: user.id, email: user.email, pickedIndices, deviceHash, ipHash });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }
    return NextResponse.json({ ok: true, result: result.result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[boli] /api/boli/dive/play failed:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong — try again in a moment." }, { status: 500 });
  }
}
