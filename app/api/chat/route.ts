import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { checkRateLimit } from "@/lib/rateLimit";
import { SHOP_FACTS, SYSTEM_RULES } from "@/lib/chat/knowledge";
import { getCatalogueContext, getPaymentContext } from "@/lib/chat/catalogue.server";
import { CHAT_TOOLS, runTool } from "@/lib/chat/tools.server";
import { sanitiseHistory } from "@/lib/chat/history";
import { claimChatRequest, recordChatUsage } from "@/lib/chat/usage.server";

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

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const history = sanitiseHistory(body.messages);
  if (history.length === 0) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  // Claimed only once the request is known to be well-formed: a malformed
  // body should not spend the shop's daily allowance.
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
      text: user
        ? `The customer you are speaking to is signed in as ${user.name}. You may greet them by first name.`
        : "The customer you are speaking to is NOT signed in. You cannot see their orders until they sign in.",
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

          response.on("text", (delta) => send("text", { delta }));

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
            send("done", {});
            controller.close();
            return;
          }

          // Tell the widget something is happening; a silent pause while an
          // order lookup runs reads as a hang.
          send("thinking", {});

          messages.push({ role: "assistant", content: final.content });
          messages.push({
            role: "user",
            content: await Promise.all(
              toolUses.map(async (t) => ({
                type: "tool_result" as const,
                tool_use_id: t.id,
                content: JSON.stringify(
                  await runTool(t.name, (t.input ?? {}) as Record<string, unknown>, {
                    user,
                    clientKey: key,
                  })
                ),
              }))
            ),
          });
        }

        // Ran out of rounds. Say so rather than closing silently.
        recordChatUsage(key, spend);
        send("text", {
          delta: "\n\nSorry, I got stuck on that one. Would you like me to pass it to the team?",
        });
        send("done", {});
        controller.close();
      } catch (err) {
        // A failed request still burned whatever it burned before failing.
        recordChatUsage(key, spend);
        console.error("[chat] request failed:", err);
        send("error", { message: customerFacingError(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
