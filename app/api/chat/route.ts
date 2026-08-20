import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { checkRateLimit } from "@/lib/rateLimit";
import { SHOP_FACTS, SYSTEM_RULES } from "@/lib/chat/knowledge";
import { getCatalogueContext, getPaymentContext } from "@/lib/chat/catalogue.server";
import { describeCart } from "@/lib/chat/cart.server";
import { describeStaffContext } from "@/lib/chat/history.server";
import { CHAT_TOOLS, runTool } from "@/lib/chat/tools.server";
import { sanitiseHistory } from "@/lib/chat/history";
import { claimChatRequest, recordChatUsage } from "@/lib/chat/usage.server";
import { cookies } from "next/headers";
import { replyInTelegram, escapeTelegramHtml } from "@/lib/telegram";
import {
  CHAT_COOKIE,
  newVisitorToken,
  getOrCreateConversation,
  appendMessage,
  getConversationState,
  addTelegramAnchor,
  handBackIfIdle,
  HANDBACK_AFTER_MINUTES,
} from "@/lib/chat/conversations.server";

/**
 * The customer assistant's endpoint.
 *
 * Everything expensive or dangerous is decided here, before the model runs:
 * who the caller is, whether they may call at all, and how much work a single
 * request is allowed to cause. The model is handed a bounded problem.
 *
 * Streams Server-Sent Events. Tool calls are resolved server-side inside the
 * loop, so the browser never sees a tool name, a tool result, or the system
 * prompt -- it receives text and nothing else.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.CHAT_MODEL ?? "claude-haiku-4-5-20251001";

/** Caps. Each one exists because its absence is a way to spend money.
 *  Message length and history depth live in lib/chat/history.ts with the
 *  sanitiser that enforces them. */
const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 800;

/** Per-visitor request budget. Generous for a shopper, useless for a scraper. */
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 600;

/**
 * Identifies a caller for rate limiting.
 *
 * Session id first where there is one, falling back to the forwarded IP.
 * Neither is unforgeable, which is exactly why this file also caps rounds and
 * output tokens: the limiter shapes ordinary abuse, and the caps bound what a
 * determined caller can cost even after defeating it.
 */
function clientKey(req: Request, userId: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return `ip:${fwd.split(",")[0]?.trim() || "unknown"}`;
}

/**
 * Turns an API failure into something worth saying to a customer.
 *
 * The distinction that matters is retryable or not. "Please try again" is
 * useless advice when the shop's credit has run out or the key has been
 * revoked: the customer retries, fails again, and leaves believing the shop is
 * broken. Those cases point at email instead, which is a route that works.
 *
 * The customer is never told which one it was. "Our billing lapsed" is the
 * shop's problem to see in the logs, not the customer's to read.
 */
function customerFacingError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const detail = JSON.stringify((err as { error?: unknown })?.error ?? "");

  // Out of credit, revoked key, missing permission: no amount of retrying
  // fixes any of these, and all of them need a human at the shop's end.
  const unfixableByRetrying =
    status === 401 || status === 403 || (status === 400 && /credit balance/i.test(detail));

  if (unfixableByRetrying) {
    console.error("[chat] ASSISTANT IS DOWN AND NEEDS ATTENTION -- check API key and credit balance.");
    return "The assistant is unavailable at the moment. Please email sales@aranzo.co and we will help you directly.";
  }

  // Anthropic rate limit or overload: genuinely worth trying again shortly.
  if (status === 429 || status === 529) {
    return "The assistant is busy right now. Please try again in a moment.";
  }

  return "Something went wrong on our side. Please try again, or email sales@aranzo.co.";
}

/**
 * Strips em and en dashes out of the assistant's text.
 *
 * The prompt already forbids them and the model uses them anyway, which is the
 * whole argument for doing it here: a house style that depends on a model
 * remembering is not a house style. Applied per delta, which is safe because
 * these are single code points and the decoder never splits one across chunks.
 *
 * The replacement is a comma-free ", " only where the dash was already spaced,
 * since that is how the model uses it -- as a pause, not as a range.
 */
function stripDashes(text: string): string {
  return text.replace(/\s+[\u2014\u2013]\s+/g, ", ").replace(/[\u2014\u2013]/g, "-");
}

/** One complete SSE response: a single message, then done. */
function sseOnce(text: string): string {
  return (
    `event: text\ndata: ${JSON.stringify({ delta: text })}\n\n` +
    `event: done\ndata: {}\n\n`
  );
}

/**
 * Headers for a streamed answer, issuing the conversation cookie when new.
 *
 * Shared by both paths because both mint the same conversation: a customer
 * whose first message arrives while staff already own the thread still needs
 * the token, or they can never read the reply.
 */
function sseHeaders(newToken: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
  });
  if (newToken) {
    headers.append(
      "Set-Cookie",
      // A SESSION cookie: no Max-Age, no Expires, so the browser drops it when
      // it closes. That matches the client side, which holds the conversation
      // in sessionStorage -- the two have to expire together or a returning
      // customer gets an empty panel that is somehow still attached to a live
      // conversation staff can reply into.
      //
      // The cost is real and accepted: close the browser before staff answer
      // and that reply has nowhere to land. Their contact details were taken
      // at escalation precisely so there is another way to reach them.
      //
      // httpOnly because this token is what reads the conversation back; lax
      // is enough because nothing here is state-changing on someone's behalf.
      `${CHAT_COOKIE}=${newToken}; Path=/; HttpOnly; SameSite=Lax` +
        (process.env.NODE_ENV === "production" ? "; Secure" : "")
    );
  }
  return headers;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const user = await getCurrentUser();
  const key = clientKey(req, user?.id ?? null);

  if (!checkRateLimit(`chat:${key}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS)) {
    return NextResponse.json(
      { error: "You have sent a lot of messages just now. Please give it a minute." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: { messages?: unknown; cart?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const history = sanitiseHistory(body.messages);
  if (history.length === 0) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  /**
   * The conversation this browser owns.
   *
   * The token is minted here rather than in middleware so it only exists for
   * someone who actually used the assistant, and it is httpOnly because it is
   * a bearer credential: whoever holds it reads the replies.
   *
   * Persistence failing must not cost the customer their answer -- the model
   * can still reply, they just could not have been sent a human reply anyway
   * if the database is down. So conversationId stays null and the request
   * carries on.
   */
  const jar = await cookies();
  const existingToken = jar.get(CHAT_COOKIE)?.value;
  const visitorToken = existingToken ?? newVisitorToken();

  let conversationId: string | null = null;
  try {
    conversationId = await getOrCreateConversation({ visitorToken, userId: user?.id ?? null });
    await appendMessage({
      conversationId,
      role: "customer",
      content: history[history.length - 1].content,
    });
  } catch (err) {
    console.error("[chat] could not persist conversation:", err);
  }

  /**
   * A conversation staff have taken over does not go to the model at all.
   *
   * Not "the model is told to be quiet" -- it is never called. A model
   * instructed to stay silent still answers sometimes, and the one place that
   * must not happen is after a customer has been told a person is coming. The
   * customer's message is carried to Telegram instead, threaded under the
   * original so whoever is answering keeps the context.
   */
  /**
   * A conversation handed to staff who then went quiet comes back to the
   * assistant.
   *
   * Checked here, on the customer's next message, rather than by a scheduled
   * job: the only moment the mode matters is when there is something to
   * answer, so there is nothing for a cron to usefully do in between.
   */
  let handedBack = false;
  if (conversationId) handedBack = await handBackIfIdle(conversationId);

  const state = conversationId ? await getConversationState(visitorToken) : null;
  if (state?.mode === "human" && state.telegramChatId && state.telegramMessageId !== null) {
    const customerText = history[history.length - 1].content;

    const forwarded = await replyInTelegram({
      chatId: state.telegramChatId,
      replyToMessageId: state.telegramMessageId,
      html: `\u{1F464} <b>Customer:</b> ${escapeTelegramHtml(customerText.slice(0, 3_000))}`,
    });

    // Staff will reply to THIS, not to the original alert several messages up.
    if (forwarded) {
      await addTelegramAnchor({
        conversationId: state.id,
        chatId: state.telegramChatId,
        messageId: forwarded,
      });
    }

    if (!forwarded) {
      console.error("[chat] could not forward a customer message to staff.");
    }

    return new Response(
      // Same SSE shape as a model answer, so the widget needs no special case.
      sseOnce(
        forwarded
          ? "Thanks, I have passed that on. Someone from the team will reply here shortly."
          : "I could not reach the team just now. Please email sales@aranzo.co and we will help you."
      ),
      { headers: sseHeaders(existingToken ? null : visitorToken) }
    );
  }

  // Claimed here, and not a line earlier: the request is known to be
  // well-formed AND known to need the model. A malformed body should not
  // spend the shop's daily allowance, and neither should a message a person
  // is going to answer.
  const claim = await claimChatRequest(key);
  if (!claim.ok) {
    return NextResponse.json(
      {
        error:
          claim.scope === "global"
            ? "The assistant has taken more questions than usual today and is resting. Please email sales@aranzo.co and we will help."
            : "You have reached today's limit for the assistant. Please email sales@aranzo.co if you still need help.",
      },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [catalogue, payment] = await Promise.all([getCatalogueContext(), getPaymentContext()]);

  /**
   * Cache breakpoint after the catalogue: the rules and the product list are
   * identical on every request and dwarf the conversation, so caching them
   * turns most of each call into a cache read. The signed-in line goes last,
   * outside the cached block, because it varies per user.
   */
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: `${SYSTEM_RULES}\n\n=== SHOP FACTS ===\n${SHOP_FACTS}\n\n=== ${payment} ===\n\n=== CATALOGUE ===\n${catalogue}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: [
        user
          ? `The customer you are speaking to is signed in as ${user.name}. You may greet them by first name.`
          : "The customer you are speaking to is NOT signed in. get_my_orders will return nothing for them; use look_up_order instead, which needs their order number and the phone or email they used.",
        await describeCart(body.cart),
        await describeStaffContext(conversationId),
        handedBack
          ? `Nobody at the shop has replied for over ${HANDBACK_AFTER_MINUTES} minutes, so this conversation ` +
            "has come back to you. The customer was told a person would answer. Acknowledge that briefly and " +
            "honestly in one sentence, without blaming anyone or promising when the team will reply, then help " +
            "with what they asked. If it still needs a person, use escalate_to_team again."
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Accumulated across every round, then written once. A tool-using
      // question costs several model turns and all of them are the shop's
      // spend, so recording only the last would undercount the expensive ones.
      const spend = { input: 0, output: 0 };
      // What the customer is actually shown, kept so it can be stored as the
      // assistant's turn. Staff replying in Telegram need to see what the
      // assistant already said, or they repeat it.
      let answer = "";

      const persistAnswer = () => {
        if (!conversationId || !answer.trim()) return;
        void appendMessage({ conversationId, role: "assistant", content: answer.slice(0, 8_000) }).catch(
          (err) => console.error("[chat] could not store the answer:", err)
        );
      };

      try {
        // Each round is one model turn. A round that ends in tool_use runs the
        // tools and goes again; anything else is the final answer.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            system,
            tools: CHAT_TOOLS,
            messages,
          });

          response.on("text", (delta) => {
            const clean = stripDashes(delta);
            answer += clean;
            send("text", { delta: clean });
          });

          const final = await response.finalMessage();

          // Cache reads and cache writes are billed differently from ordinary
          // input, but all three are input the shop pays for; summing them
          // keeps this an honest total rather than a flattering one.
          spend.input +=
            (final.usage.input_tokens ?? 0) +
            (final.usage.cache_read_input_tokens ?? 0) +
            (final.usage.cache_creation_input_tokens ?? 0);
          spend.output += final.usage.output_tokens ?? 0;
          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUses.length === 0) {
            recordChatUsage(key, spend);
            persistAnswer();
            send("done", {});
            controller.close();
            return;
          }

          // Tell the widget something is happening; a silent pause while an
          // order lookup runs reads as a hang.
          send("thinking", {});

          messages.push({ role: "assistant", content: final.content });

          const results = await Promise.all(
            toolUses.map(async (t) => ({
              tool: t.name,
              id: t.id,
              result: await runTool(t.name, (t.input ?? {}) as Record<string, unknown>, {
                user,
                clientKey: key,
                conversationId,
              }),
            }))
          );

          // The cart lives in the browser, so a successful add_to_cart has to
          // travel back as an event for the widget to apply. The model gets
          // the same result either way; this is the half it cannot perform.
          for (const r of results) {
            const line = (r.result as { added?: boolean; line?: unknown })?.line;
            if (r.tool === "add_to_cart" && line) send("cart", { line });
          }

          messages.push({
            role: "user",
            content: results.map((r) => ({
              type: "tool_result" as const,
              tool_use_id: r.id,
              content: JSON.stringify(r.result),
            })),
          });
        }

        // Ran out of rounds. Say so rather than closing silently.
        recordChatUsage(key, spend);
        persistAnswer();
        send("text", {
          delta: "\n\nSorry, I got stuck on that one. Would you like me to pass it to the team?",
        });
        send("done", {});
        controller.close();
      } catch (err) {
        // A failed request still burned whatever it burned before failing.
        recordChatUsage(key, spend);
        persistAnswer();
        console.error("[chat] request failed:", err);
        send("error", { message: customerFacingError(err) });
        controller.close();
      }
    },
  });

  // The cookie only rides out when it is new. Re-sending an unchanged one on
  // every message is pure overhead on a streaming response.
  return new Response(stream, { headers: sseHeaders(existingToken ? null : visitorToken) });
}
