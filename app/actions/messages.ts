"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import {
  createMessage,
  deleteMessage,
  setMessageStatus,
  type MessageStatus,
} from "@/lib/data/messages.server";

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

  createMessage({ name, phone, message });
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
  redirect("/contact?sent=1");
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");
}

export async function setMessageStatusAction(id: string, status: MessageStatus): Promise<void> {
  await requireAdmin();
  setMessageStatus(id, status);
  revalidatePath("/dashboard/messages");
}

export async function deleteMessageAction(id: string): Promise<void> {
  await requireAdmin();
  deleteMessage(id);
  revalidatePath("/dashboard/messages");
}
