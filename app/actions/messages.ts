"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  createMessage,
  deleteMessage,
  setMessageStatus,
  type MessageStatus,
} from "@/lib/data/messages.server";

async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Public: submit the contact form. */
export async function submitMessageAction(formData: FormData): Promise<void> {
  // Honeypot: real visitors never fill this hidden field.
  if (String(formData.get("website") ?? "")) redirect("/contact?sent=1");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !phone || !message) {
    redirect("/contact?error=1");
  }

  if (!checkRateLimit(`contact:ip:${await clientIp()}`, 5, 600)) {
    redirect("/contact?error=1");
  }

  await createMessage({ name, phone, message });
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  redirect("/contact?sent=1");
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
}

export async function setMessageStatusAction(id: string, status: MessageStatus): Promise<void> {
  await requireAdmin();
  await setMessageStatus(id, status);
  revalidatePath("/dashboard/messages");
}

export async function deleteMessageAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteMessage(id);
  revalidatePath("/dashboard/messages");
}
