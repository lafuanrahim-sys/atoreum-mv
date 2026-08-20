import type Anthropic from "@anthropic-ai/sdk";
import type { PublicUser } from "@/lib/data/users.server";
import { getAllOrders } from "@/lib/data/orders.server";
import { getProductById } from "@/lib/data/products.server";
import { sendTelegramMessageAnchored, escapeTelegramHtml, telegramConfigured } from "@/lib/telegram";
import {
  linkTelegramMessage,
  setConversationContact,
  getRecentMessages,
  setConversationMode,
} from "@/lib/chat/conversations.server";
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
    name: "add_to_cart",
    description:
      "Put a product in the customer's basket. Use it when they ask you to add something, " +
      "or agree to a suggestion. Always name the product and the price in your reply afterwards, " +
      "so they can see what went in. Only products from the catalogue can be added, and only " +
      "when in stock. Do not use this to check a price; the catalogue already has prices.",
    input_schema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "The catalogue id, e.g. fom-001. Not the name.",
        },
        quantity: {
          type: "integer",
          description: "How many. Defaults to 1. Ask the customer before adding more than a few.",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["product_id"],
    },
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
  clientKey: string,
  conversationId: string | null
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

  // The last few turns, so whoever answers is not guessing at what was already
  // said. Without it staff repeat the assistant, or answer a question that has
  // moved on two messages ago.
  let transcript: string[] = [];
  if (conversationId) {
    try {
      const recent = await getRecentMessages(conversationId, 6);
      transcript = recent.map((m) => {
        const label =
          m.role === "customer" ? "Customer" : m.role === "staff" ? m.staffName || "Shop" : "Assistant";
        return `<b>${label}:</b> ${escapeTelegramHtml(m.content.slice(0, 400))}`;
      });
    } catch (err) {
      console.error("[chat] could not load transcript for escalation:", err);
    }
  }

  const anchor = await sendTelegramMessageAnchored(
    [
      "\u{1F4AC} <b>Question from the website assistant</b>",
      "",
      `<b>From:</b> ${who}`,
      contact ? `<b>Contact:</b> ${escapeTelegramHtml(contact)}` : "<b>Contact:</b> not given",
      "",
      escapeTelegramHtml(question),
      ...(transcript.length ? ["", "<b>Recent conversation</b>", ...transcript] : []),
      "",
      conversationId
        ? "<i>Reply to this message to answer. The assistant has stopped, and everything the customer types now comes here. Reply <b>/ai</b> to hand it back to the assistant.</i>"
        : "<i>This conversation could not be saved, so a reply here will not reach the customer.</i>",
    ].join("\n")
  );

  if (!anchor) {
    return {
      sent: false,
      reason: "The message could not be delivered. Ask the customer to email sales@aranzo.co.",
    };
  }

  // Anchor the conversation to the message staff will reply to. If this fails
  // the question still reached them; they just have to use the contact details
  // rather than replying in the thread.
  let handedOver = false;
  if (conversationId) {
    try {
      if (contact) await setConversationContact(conversationId, contact);
      await linkTelegramMessage({ conversationId, chatId: anchor.chatId, messageId: anchor.messageId });
      // Only now, with somewhere for staff to reply, does the assistant stand
      // down. Doing it before the anchor exists would leave the customer
      // talking to nobody.
      handedOver = (await setConversationMode(conversationId, "human")) === "human";
    } catch (err) {
      console.error("[chat] could not hand the conversation to staff:", err);
    }
  }

  return {
    sent: true,
    handedOver,
    // The model writes the words; this tells it what is now true so it does
    // not promise a callback it cannot see happen.
    note: handedOver
      ? "A person will answer in this chat window. Tell the customer to keep it open and wait, and that you are stepping aside now."
      : "The team has the question, but this chat cannot receive their reply. Tell the customer they will be contacted using the details they gave.",
  };
}

/** The most a model may add in one go without the customer saying a number. */
const MAX_CART_QUANTITY = 10;

/**
 * Validate a requested cart addition.
 *
 * The server cannot put anything in the basket -- the cart is client state in
 * the customer's browser -- so this returns the line for the route to forward,
 * and the browser applies it. That split is convenient rather than principled,
 * but it does mean the checking has to happen here: the model names a product
 * id and nothing else is taken on trust.
 *
 * Refusals are worded for the customer, because the model repeats them.
 */
async function runAddToCart(args: { product_id?: unknown; quantity?: unknown }) {
  const id = String(args.product_id ?? "").trim().toLowerCase();
  if (!id) return { added: false, reason: "No product was specified." };

  const product = await getProductById(id);
  if (!product) {
    return {
      added: false,
      reason: `There is no product with the id "${id}". Only ids from the catalogue can be added.`,
    };
  }
  if (product.stockStatus === "out-of-stock") {
    return { added: false, reason: `${product.name} is out of stock, so it cannot be added.` };
  }

  const requested = Number(args.quantity ?? 1);
  const quantity = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_CART_QUANTITY)
    : 1;

  return {
    added: true,
    quantity,
    // Priced from priceEffective, the same figure the product card and the
    // order total use. Quoting `price` here would put the pre-discount amount
    // in the basket and make the assistant appear to overcharge.
    line: {
      productId: product.id,
      name: product.name,
      price: product.priceEffective,
      currency: product.currency,
      image: product.images[0] ?? null,
      quantity,
    },
    note: `${quantity} x ${product.name} at MVR ${product.priceEffective} each.`,
  };
}

/** Dispatch. Unknown names return an error to the model rather than throwing. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { user: PublicUser | null; clientKey: string; conversationId?: string | null }
): Promise<unknown> {
  switch (name) {
    case "get_my_orders":
      return runGetMyOrders(ctx.user);
    case "add_to_cart":
      return runAddToCart(args);
    case "escalate_to_team":
      return runEscalate(args, ctx.user, ctx.clientKey, ctx.conversationId ?? null);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
