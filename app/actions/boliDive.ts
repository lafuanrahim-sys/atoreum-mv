"use server";

import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { dismissDiveIntro, resetTodaysPlayForTesting } from "@/lib/boli/dive.server";
import { UNLIMITED_DIVE_PLAYS_FOR_ADMINS } from "@/lib/boli/config";

export async function dismissDiveIntroAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await dismissDiveIntro(user.id);
}

/**
 * Testing-only replay: lets an admin clear today's play and roll again.
 * Double-gated here (not just in the UI) — flag off or non-admin, this is
 * a no-op, so there's no way to reach the reset path except through the
 * button this backs, and only while UNLIMITED_DIVE_PLAYS_FOR_ADMINS is on.
 */
export async function replayDiveTestAction() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role) || !UNLIMITED_DIVE_PLAYS_FOR_ADMINS) return;
  await resetTodaysPlayForTesting(user.id);
}
