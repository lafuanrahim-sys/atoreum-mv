import { getRecentMessages, STAFF_DISPLAY_NAME } from "@/lib/chat/conversations.server";

/**
 * What a person already said to this customer.
 *
 * The browser sends the conversation it is showing, but staff turns are
 * deliberately stripped from it before the model sees them: sent as the
 * assistant's own words, the model would treat a colleague's promise as
 * something it said itself and defend it.
 *
 * Stripping them entirely is worse though. After a handover the assistant
 * picks up a conversation a human has been holding, with no idea what was
 * agreed -- and cheerfully contradicts it. So the staff turns come back as
 * context: labelled as somebody else's words, and framed as commitments to be
 * honoured rather than repeated.
 *
 * Read from the database, not the browser, because these are the shop's words
 * and must not be forgeable by editing a payload. Bounded by the same
 * retention as everything else: when the conversation is pruned, this is gone
 * with it.
 */

const MAX_STAFF_TURNS = 8;

export async function describeStaffContext(conversationId: string | null): Promise<string> {
  if (!conversationId) return "";

  try {
    // Pulls the tail of the conversation and keeps the staff half. Asking for
    // more than the transcript's end is pointless: what a colleague said an
    // hour and forty messages ago is not what the assistant is about to
    // contradict.
    const recent = await getRecentMessages(conversationId, 30);
    const staff = recent.filter((m) => m.role === "staff").slice(-MAX_STAFF_TURNS);
    if (staff.length === 0) return "";

    return [
      `A PERSON FROM THE SHOP HAS ALREADY REPLIED IN THIS CONVERSATION, as "${STAFF_DISPLAY_NAME}".`,
      "These are their words, not yours. Do not repeat them, do not present them as your own,",
      "and never contradict or walk back anything they committed to. If the customer is asking",
      "about something a colleague already settled, treat it as settled. If you think they got it",
      "wrong, do not say so; use escalate_to_team.",
      "",
      ...staff.map((m) => `- ${m.content.slice(0, 500)}`),
    ].join("\n");
  } catch (err) {
    console.error("[chat] could not load staff context:", err);
    return "";
  }
}
