"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { deleteConversation } from "@/lib/chat/conversations.server";

/**
 * Deleting a stored conversation.
 *
 * Conversations are kept indefinitely, so this is the only thing that removes
 * one, and it removes it properly: chat_messages and chat_telegram_anchors
 * both cascade from the conversation row. There is no archived state and no
 * undo, which is the right shape for a record someone is deleting on purpose
 * -- usually because it contains a phone number or a complaint that has been
 * dealt with and need not be kept.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
  return user;
}

export async function deleteConversationAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteConversation(id);
  revalidatePath("/dashboard/chats");
  redirect("/dashboard/chats?deleted=1");
}
