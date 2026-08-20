import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CHAT_COOKIE,
  getStaffMessagesSince,
  STAFF_DISPLAY_NAME,
} from "@/lib/chat/conversations.server";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * Staff replies, for the customer's chat panel.
 *
 * Polled while the panel is open. Polling rather than a socket because the
 * shop replies in minutes or hours, not seconds -- two people also doing
 * deliveries are not manning a chat desk -- and a held-open connection per
 * visitor buys nothing against that.
 *
 * The only credential is the httpOnly cookie. The browser never names a
 * conversation, so there is no id for anyone to change: a request either
 * carries a token that owns a conversation or it reads nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = (await cookies()).get(CHAT_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ messages: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  // A poll is one indexed read, but it is also an unauthenticated endpoint on
  // a timer, so it gets a ceiling like everything else here.
  if (!checkRateLimit(`chat-poll:${token}`, 120, 60)) {
    return NextResponse.json({ messages: [] }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const sinceRaw = new URL(req.url).searchParams.get("since");
  // Reject an unparseable timestamp rather than passing it to Postgres, where
  // it would raise instead of simply meaning "everything".
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : null;

  try {
    const messages = await getStaffMessagesSince({ visitorToken: token, since });
    // The real sender is recorded, but only "Customer Support" leaves the
    // building. Which of two people picked the message up is the shop's
    // business, and shipping it would put a staff member's name in every
    // customer's browser for no benefit to either of them.
    return NextResponse.json(
      {
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
          from: STAFF_DISPLAY_NAME,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[chat] poll failed:", err);
    return NextResponse.json({ messages: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
