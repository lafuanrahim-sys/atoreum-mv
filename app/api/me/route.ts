import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";

/**
 * Lightweight session probe for client components (header profile icon,
 * favorites context). Returns only non-sensitive fields.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(
    {
      loggedIn: true,
      name: user.name,
      role: user.role,
      favorites: user.favorites,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
