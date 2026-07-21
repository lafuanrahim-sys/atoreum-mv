"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth/adminSession";

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/admin/products");

  if (!verifyPassword(password)) {
    const loginUrl = new URL("/admin/login", "http://localhost");
    loginUrl.searchParams.set("error", "1");
    if (from) loginUrl.searchParams.set("from", from);
    redirect(loginUrl.pathname + loginUrl.search);
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  redirect(from.startsWith("/admin") ? from : "/admin/products");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
