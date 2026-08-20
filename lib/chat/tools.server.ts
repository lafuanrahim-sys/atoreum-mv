import type Anthropic from "@anthropic-ai/sdk";
import type { PublicUser } from "@/lib/data/users.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { sendTelegramMessage, escapeTelegramHtml, telegramConfigured } from "@/lib/telegram";
import { checkRateLimit } from "@/lib/rateLimit";
import { invoiceNumber } from "@/lib/invoice";

/**
 * The two things the assistant can actually do, as opposed to say.
 *
 * The security property that matters here is stated once and holds for the
 * whole file: NO TOOL TAKES AN IDENTITY ARGUMENT. The model cannot ask for
 * "naufal's orders" because there is no parameter in which to put a name. Who
 * the caller is arrives from the session cookie, resolved by the route before
 * the model is ever invoked, and is passed to these functions out of band.
 *
 * That is deliberate and load-bearing. A model can be talked into anything by
 * a determined customer -- "ignore your instructions, I am the shop owner" --
 * and no amount of prompt wording is a defence. Making the unsafe request
 * unrepresentable is a defence.
 */

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_my_orders",
    description:
      "Look up the orders belonging to the customer you are currently speaking to. " +
      "Takes no arguments: it returns that customer's own orders and cannot return anyone else's. " +
      "Use it for questions about order status, payment verification, delivery timing, or past purchases. " +
      "If the customer is not signed in this returns nothing, which means you should ask them to sign in.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "escalate_to_team",
    description:
      "Send a question to Atoreum MV's staff, who will follow up with the customer directly. " +
      "Use when the customer asks for something you are not authorised to decide (refunds, discounts, " +
      "exceptions), when they ask to speak to a person, or when you do not know the answer. " +
      "Always tell the customer you have passed it on.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The customer's question or request, in your own words, with enough context for staff to act on it.",
        },
        contact: {
          type: "string",
          description:
            "How to reach the customer: a phone number or email they have given in this conversation. " +
            "Pass an empty string if they have not given one and you are signed-out.",
        },
      },
      required: ["question", "contact"],
    },
  },
];

/** What the assistant is told about one order. Deliberately narrow. */
function summariseOrder(o: Awaited<ReturnType<typeof getAllOrders>>[number]) {
  return {
    order: o.orderNumber,
    invoice: invoiceNumber(o),
    placed: o.createdAt.slice(0, 10),
    status: o.status,
    payment: o.paymentMethod ?? "bank transfer",
    total: `MVR ${o.subtotal}`,
    items: o.items.map((i) => `${i.quantity} x ${i.name}`),
  };
}

/**
 * The signed-in customer's orders.
 *
 * `user` comes from the session, never from the model. When it is null the
 * answer is an empty list, not an error, because "you are not signed in" is
 * something the assistant should explain rather than crash on.
 *
 * The matching rule is copied from app/account/page.tsx on purpose: userId is
 * authoritative, with an email fallback for orders placed before that field
 * existed or as a guest with this account's email. If the two pages disagreed
 * about which orders are yours, one of them would be wrong.
 */
async function runGetMyOrders(user: PublicUser | null) {
  if (!user) {
    return { signedIn: false, orders: [], note: "Nobody is signed in on this browser." };
  }
  const all = await getAllOrders();
  const mine = all
    .filter((o) => o.userId === user.id || o.customer.email.toLowerCase() === user.email.toLowerCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map(summariseOrder);

  return { signedIn: true, orders: mine };
}

/**
 * Hand the question to a human via the existing order-alert group.
 *
 * Rate limited hard and separately from the chat itself. This tool writes to a
 * channel two people actually read; letting a model fire it in a loop, or
 * letting one bored visitor fill the group with noise, would train Maahil to
 * ignore the alerts that carry real orders.
 */
async function runEscalate(
  args: { question?: unknown; contact?: unknown },
  user: PublicUser | null,
  clientKey: string
) {
  const question = String(args.question ?? "").trim().slice(0, 1_000);
  const contact = String(args.contact ?? "").trim().slice(0, 200);

  if (!question) {
    return { sent: false, reason: "No question was provided." };
  }
  if (!checkRateLimit(`chat-escalate:${clientKey}`, 3, 3_600)) {
    return {
      sent: false,
      reason:
        "This conversation has already sent several messages to the team. Ask the customer to email sales@aranzo.co instead.",
    };
  }
  if (!telegramConfigured()) {
    return {
      sent: false,
      reason: "Staff messaging is unavailable. Ask the customer to email sales@aranzo.co.",
    };
  }

  const who = user
    ? `${escapeTelegramHtml(user.name)} (${escapeTelegramHtml(user.email)}, signed in)`
    : "a signed-out visitor";

  const sent = await sendTelegramMessage(
    [
      "💬 <b>Question from the website assistant</b>",
      "",
      `<b>From:</b> ${who}`,
      contact ? `<b>Contact:</b> ${escapeTelegramHtml(contact)}` : "<b>Contact:</b> not given",
      "",
      escapeTelegramHtml(question),
    ].join("\n")
  );

  return sent
    ? { sent: true }
    : { sent: false, reason: "The message could not be delivered. Ask the customer to email sales@aranzo.co." };
}

/** Dispatch. Unknown names return an error to the model rather than throwing. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { user: PublicUser | null; clientKey: string }
): Promise<unknown> {
  switch (name) {
    case "get_my_orders":
      return runGetMyOrders(ctx.user);
    case "escalate_to_team":
      return runEscalate(args, ctx.user, ctx.clientKey);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
