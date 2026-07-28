import { NextRequest, NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/userSession";
import { setSessionCookie } from "@/lib/auth/setSessionCookie.server";
import { verifyEmailToken } from "@/lib/data/users.server";

/**
 * Destination of the link in the verification email (a GET, since it's
 * clicked from a mail client, not submitted from a form on this site).
 * Success signs the user in immediately — clicking the link already proves
 * ownership of the account, so there's no reason to make them re-enter
 * their password right after.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await verifyEmailToken(token);

  const url = request.nextUrl.clone();
  url.search = "";

  if ("error" in result) {
    url.pathname = "/login";
    url.searchParams.set("mode", "login");
    url.searchParams.set("error", "verify-failed");
    return NextResponse.redirect(url);
  }

  await setSessionCookie(result.id, result.role);

  url.pathname = isAdminRole(result.role) ? "/dashboard" : "/account";
  url.searchParams.set("verified", "1");
  return NextResponse.redirect(url);
}
