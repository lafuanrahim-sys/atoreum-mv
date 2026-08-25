import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { getNotificationState } from "@/lib/data/notifications.server";

/**
 * Lightweight session probe for client components (header profile icon,
 * favorites context). Returns only non-sensitive fields.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false }, { headers: { "Cache-Control": "no-store" } });
  }
  // Admins get the dashboard, not the profile, so the dot would point nowhere
  // useful for them. Customers only.
  const notifications =
    user.role === "customer" ? await getNotificationState(user) : { hasUnseen: false };

  return NextResponse.json(
    {
      loggedIn: true,
      name: user.name,
      role: user.role,
      favorites: user.favorites,
      hasUnseen: notifications.hasUnseen,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
