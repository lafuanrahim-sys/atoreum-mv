import { NextResponse } from "next/server";
import {
  findConversationByTelegramMessage,
  appendMessage,
  setConversationMode,
  addTelegramAnchor,
  touchStaffActivity,
  getPresence,
} from "@/lib/chat/conversations.server";
import { allConfiguredChatIds, replyInTelegram, escapeTelegramHtml } from "@/lib/telegram";

/**
 * Staff replies, arriving from Telegram.
 *
 * A shop person replies to the escalation message in the group the way they
 * would reply to anyone. Telegram posts the update here, the replied-to
 * message names the conversation, and the text becomes a staff message the
 * customer sees in their chat panel.
 *
 * THIS ENDPOINT IS PUBLIC AND ANYONE CAN FIND IT. Its whole job is to decide
 * that a given update is really from the shop's own staff group, because
 * whatever it accepts is shown to a customer as though the shop said it.
 * Three independent checks have to pass, and none of them trusts the payload:
 *
 *   1. The secret token header, which only Telegram knows because we set it.
 *   2. The chat id, which must be one of the configured staff chats. Anyone
 *      can start a private chat with the bot; that is not the shop.
 *   3. The message must be a REPLY to a message we anchored. An unprompted
 *      message in the group is conversation between staff, not an answer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
    from?: { first_name?: string; username?: string; is_bot?: boolean };
    reply_to_message?: { message_id?: number };
  };
};

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  // Without a configured secret there is no way to tell Telegram from anyone
  // else, so the endpoint refuses to work at all rather than accepting
  // whatever arrives. Failing closed is the only safe default here.
  if (!secret) {
    console.error("[telegram] webhook called but TELEGRAM_WEBHOOK_SECRET is not set -- refusing.");
    return NextResponse.json({ ok: true });
  }

  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    console.warn("[telegram] webhook rejected: bad or missing secret token.");
    // 200 regardless: a prober learns nothing from the status code, and
    // Telegram retries anything that is not a 2xx.
    return NextResponse.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id !== undefined ? String(msg.chat.id) : null;
  const replyTo = msg?.reply_to_message?.message_id;
  const text = (msg?.text ?? "").trim();

  /**
   * /id -- the bot tells you which chat you are in.
   *
   * Setting up a second group means finding its chat id, and the usual routes
   * are both closed: getUpdates is disabled while a webhook is registered, and
   * the third-party "what is my id" bots run with privacy mode on so they
   * cannot see group messages at all.
   *
   * Answering here costs nothing and gives away nothing. A chat id is not a
   * secret -- anyone in a chat can learn its id, and knowing it grants no
   * ability to write there without the bot token. Deliberately placed BEFORE
   * the configured-chat check, since the entire point is to run in a group
   * that is not configured yet.
   *
   * A command, not a reply, because Telegram's privacy mode delivers commands
   * to a bot but withholds ordinary group chatter.
   */
  if (chatId && /^\/id(@\w+)?\b/i.test(text) && !msg?.from?.is_bot) {
    await replyInTelegram({
      chatId,
      replyToMessageId: msg!.message_id!,
      html:
        `This chat's id is <code>${escapeTelegramHtml(chatId)}</code>\n\n` +
        `Set it as <b>TELEGRAM_SUPPORT_CHAT_ID</b> to route customer chat here, ` +
        `or <b>TELEGRAM_ORDER_CHAT_ID</b> for order alerts.`,
    });
    return NextResponse.json({ ok: true });
  }

  // Not a reply, not text, or the bot's own message: nothing to route.
  if (!chatId || !replyTo || !text || msg?.from?.is_bot) {
    return NextResponse.json({ ok: true });
  }

  // The chat must be one the shop configured -- either group. A stranger who
  // finds the bot and messages it privately gets a different chat id and is
  // ignored. Checking only the ORDER group would reject every reply from the
  // support group, which is where support replies now come from.
  if (!allConfiguredChatIds().includes(chatId)) {
    console.warn(`[telegram] webhook ignored a reply from unconfigured chat ${chatId}.`);
    return NextResponse.json({ ok: true });
  }

  const conversation = await findConversationByTelegramMessage({ chatId, messageId: replyTo });
  if (!conversation) {
    // A reply to some other message in the group. Ordinary staff chatter.
    return NextResponse.json({ ok: true });
  }

  const staffName = msg?.from?.first_name?.trim() || msg?.from?.username?.trim() || "Atoreum MV";

  /**
   * Handing the conversation back to the assistant.
   *
   * Worth having because the reason a customer asked for a person is often
   * settled in one reply, and what they ask next ("what else do you have for
   * dry skin?") is exactly what the assistant answers well and instantly.
   * Without this, every escalation would trap that customer in a queue behind
   * two people who are also out delivering.
   */
  if (/^\/(ai|bot)\b/i.test(text)) {
    await setConversationMode(conversation.id, "ai");
    await appendMessage({
      conversationId: conversation.id,
      role: "staff",
      content:
        "Thanks for waiting. I am handing you back to our assistant now, which can help with products, delivery and orders straight away.",
      staffName,
    });
    const ackId = await replyInTelegram({
      chatId,
      replyToMessageId: msg!.message_id!,
      html: "Handed back to the assistant. It will answer this customer from their next message.",
    });
    // Register the acknowledgement too, so a reply to IT also lands here.
    if (ackId) await addTelegramAnchor({ conversationId: conversation.id, chatId, messageId: ackId });
    return NextResponse.json({ ok: true });
  }

  await appendMessage({
    conversationId: conversation.id,
    role: "staff",
    // Capped because it is rendered in the customer's chat panel, and because
    // Telegram will happily carry 4096 characters.
    content: text.slice(0, 4_000),
    staffName,
  });

  // A reply is also a takeover: someone answering by hand has claimed this
  // conversation, whether or not the assistant escalated it. It restarts the
  // silence clock too, so an active back-and-forth is never handed back
  // mid-exchange.
  await setConversationMode(conversation.id, "human");
  await touchStaffActivity(conversation.id);

  // Confirm in the group. Without this, staff have no idea whether the reply
  // reached anyone, and the honest answer is worth saying: the customer sees
  // it when their chat panel is open, and not before.
  /**
   * Whether that reply will actually be read.
   *
   * A closed browser takes the conversation with it, so a reply typed after
   * the customer has gone lands nowhere. Staff cannot see that, and "sent"
   * with nothing behind it is worse than no confirmation at all -- it is the
   * difference between waiting for an answer and picking up the phone.
   */
  const presence = await getPresence(conversation.id);
  const delivery =
    presence.state === "watching"
      ? "Their chat window is open, so they have it now."
      : presence.state === "away"
        ? `<b>They are not watching the chat</b> (last seen ${Math.round((presence.secondsAgo ?? 0) / 60)} min ago). ` +
          "It will be waiting if they come back in the same browser session, but a closed browser loses it. " +
          (conversation.contact
            ? `Best to reach them on <b>${escapeTelegramHtml(conversation.contact)}</b>.`
            : "No contact details were given, so there may be no other way to reach them.")
        : "Not sure whether their window is open.";

  const ackId = await replyInTelegram({
    chatId,
    replyToMessageId: msg!.message_id!,
    html:
      `Sent as <b>Customer Support</b> (from ${escapeTelegramHtml(staffName)}). ` +
      `${delivery} Reply <b>/ai</b> to hand back to the assistant.`,
  });
  if (ackId) await addTelegramAnchor({ conversationId: conversation.id, chatId, messageId: ackId });

  // Staff replying is itself a reply target: the message they just sent is the
  // newest thing in the thread and the obvious one to answer next.
  await addTelegramAnchor({ conversationId: conversation.id, chatId, messageId: msg!.message_id! });

  return NextResponse.json({ ok: true });
}
