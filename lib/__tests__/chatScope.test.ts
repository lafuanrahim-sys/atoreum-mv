import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "@/lib/types";

/**
 * Order lookup, against orders that actually exist.
 *
 * Kept apart from chat.test.ts because it has to mock the data layer, and
 * because of what it is for: this is the one place a customer-facing model
 * touches other people's personal data, so "nothing leaked" needs to be
 * demonstrated against a database with something in it to leak. Running the
 * same check against an empty table passes without proving anything.
 */

const order = (over: Partial<Order>): Order =>
  ({
    id: over.id ?? "o",
    orderNumber: over.orderNumber ?? "ATM-0000",
    invoiceSeq: 1,
    invoiceSeries: "INV",
    movesStock: true,
    items: [{ productId: "p", name: "Thing", price: 100, currency: "MVR", quantity: 1, image: null }],
    subtotal: 100,
    currency: "MVR",
    customer: {
      name: over.customer?.name ?? "Someone",
      email: over.customer?.email ?? "someone@example.com",
      phone: "7777777",
      address: "Malé",
    } as Order["customer"],
    paymentProofPath: null,
    status: "Confirmed",
    createdAt: over.createdAt ?? "2026-08-01T00:00:00Z",
    ...over,
  }) as Order;

const ORDERS: Order[] = [
  order({ id: "1", orderNumber: "ATM-0001", userId: "user-a", customer: { name: "A", email: "a@example.com", phone: "1", address: "x" } as Order["customer"] }),
  order({ id: "2", orderNumber: "ATM-0002", userId: "user-b", customer: { name: "B", email: "b@example.com", phone: "2", address: "x" } as Order["customer"] }),
  // A guest order carrying A's email but no account link: A's, by the same
  // rule /account uses.
  order({ id: "3", orderNumber: "ATM-0003", customer: { name: "A", email: "A@Example.com", phone: "3", address: "x" } as Order["customer"] }),
  // A pure guest order, no account anywhere near it.
  order({
    id: "4",
    orderNumber: "ATM-0004",
    status: "Pending Verification",
    customer: { name: "Guest", email: "guest@example.com", phone: "+960 771-2345", address: "Malé" } as Order["customer"],
  }),
];

vi.mock("@/lib/data/orders.server", () => ({
  getAllOrders: async () => ORDERS,
}));
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: async () => true,
  // Escalation sends through the anchored variant, so a reply in Telegram can
  // be routed back. Returning an anchor keeps the success path exercised.
  sendTelegramMessageAnchored: async () => ({ chatId: "-1", messageId: 1 }),
  replyInTelegram: async () => 2,
  escapeTelegramHtml: (s: string) => s,
  telegramConfigured: () => true,
  allConfiguredChatIds: () => ["-1"],
}));

const userA = { id: "user-a", name: "A", email: "a@example.com" } as never;
const userB = { id: "user-b", name: "B", email: "b@example.com" } as never;

let runTool: typeof import("@/lib/chat/tools.server").runTool;

beforeEach(async () => {
  ({ runTool } = await import("@/lib/chat/tools.server"));
});

type OrdersResult = { signedIn: boolean; orders: { order: string }[] };

describe("get_my_orders scoping", () => {
  it("returns only the caller's own orders", async () => {
    const res = (await runTool("get_my_orders", {}, { user: userA, clientKey: "t" })) as OrdersResult;
    expect(res.orders.map((o) => o.order).sort()).toEqual(["ATM-0001", "ATM-0003"]);
  });

  it("does not leak another customer's order", async () => {
    const res = (await runTool("get_my_orders", {}, { user: userA, clientKey: "t" })) as OrdersResult;
    expect(res.orders.map((o) => o.order)).not.toContain("ATM-0002");
  });

  it("matches a guest order on email case-insensitively", async () => {
    const res = (await runTool("get_my_orders", {}, { user: userA, clientKey: "t" })) as OrdersResult;
    expect(res.orders.map((o) => o.order)).toContain("ATM-0003");
  });

  it("gives a signed-out visitor nothing at all", async () => {
    const res = (await runTool("get_my_orders", {}, { user: null, clientKey: "t" })) as OrdersResult;
    expect(res.signedIn).toBe(false);
    expect(res.orders).toEqual([]);
  });

  it("ignores any argument the model invents", async () => {
    // The schema has no properties, but a model can still emit extra keys.
    // They must have no effect: B asking for A's orders gets B's.
    const res = (await runTool(
      "get_my_orders",
      { email: "a@example.com", user_id: "user-a", all: true } as Record<string, unknown>,
      { user: userB, clientKey: "t" }
    )) as OrdersResult;
    expect(res.orders.map((o) => o.order)).toEqual(["ATM-0002"]);
  });

  it("refuses an unknown tool rather than throwing", async () => {
    const res = (await runTool("delete_all_orders", {}, { user: userA, clientKey: "t" })) as { error: string };
    expect(res.error).toMatch(/unknown tool/i);
  });
});


describe("guest order lookup", () => {
  type Found = { found: boolean; reason?: string; order?: { number: string; paymentVerified: boolean } };
  const look = (order_number: string, contact: string, key = Math.random().toString()) =>
    runTool("look_up_order", { order_number, contact }, { user: null, clientKey: key }) as Promise<Found>;

  it("finds a guest order from its number and phone", async () => {
    const r = await look("ATM-0004", "7712345");
    expect(r.found).toBe(true);
    expect(r.order?.number).toBe("ATM-0004");
  });

  it("accepts the phone however it is written", async () => {
    // +960, spaces and dashes are all how a real person types their number.
    for (const form of ["+960 7712345", "960-771-2345", "771 2345", "7712345"]) {
      expect((await look("ATM-0004", form)).found).toBe(true);
    }
  });

  it("finds it by email too, ignoring case", async () => {
    expect((await look("ATM-0004", "GUEST@Example.com")).found).toBe(true);
  });

  it("refuses the right order number with the wrong contact", async () => {
    // The whole point: the number alone is guessable, so it must not be enough.
    const r = await look("ATM-0004", "9999999");
    expect(r.found).toBe(false);
  });

  it("does not reveal whether an order number exists", async () => {
    // A real number with wrong details and a made-up number must be
    // indistinguishable, or probing tells you which numbers are real.
    const real = await look("ATM-0004", "9999999");
    const fake = await look("ATM-9999", "9999999");
    expect(real.reason).toBe(fake.reason);
  });

  it("reports payment as unverified while pending", async () => {
    const r = await look("ATM-0004", "7712345");
    expect(r.order?.paymentVerified).toBe(false);
  });

  it("rate limits repeated attempts from one visitor", async () => {
    // Same key throughout: a known order number plus guesses at a 7-digit
    // mobile is a real attack if it can be run thousands of times.
    const key = "brute-force-probe";
    const results = [];
    for (let i = 0; i < 8; i++) results.push(await look("ATM-0004", `700000${i}`, key));
    expect(results.some((r) => /too many/i.test(r.reason ?? ""))).toBe(true);
  });
});


describe("escalation requires a phone number", () => {
  /**
   * The schema marks it required and the prompt insists on it, and neither is
   * a guarantee: a model that feels it has enough context will call the tool
   * with an empty string. The escalation then reaches staff with no way to
   * answer it, while the customer waits for a call that cannot happen. So the
   * refusal lives in the code, and these pin it there.
   */
  const escalate = (args: Record<string, unknown>, key = Math.random().toString()) =>
    runTool("escalate_to_team", args, { user: null, clientKey: key }) as Promise<{
      sent: boolean;
      needsPhone?: boolean;
      reason?: string;
    }>;

  it("refuses when no phone is given at all", async () => {
    const r = await escalate({ question: "wholesale" });
    expect(r.sent).toBe(false);
    expect(r.needsPhone).toBe(true);
  });

  it("refuses an empty string, a placeholder, or an email in its place", async () => {
    for (const phone of ["", "   ", "N/A", "none", "customer@example.com"]) {
      expect((await escalate({ question: "wholesale", phone })).sent).toBe(false);
    }
  });

  it("refuses a number too short to be one", async () => {
    expect((await escalate({ question: "wholesale", phone: "123" })).sent).toBe(false);
  });

  it("tells the model to ASK, rather than to apologise", async () => {
    // The next move should be a question to the customer, so the refusal has
    // to read as an instruction and must not imply the message went anywhere.
    const r = await escalate({ question: "wholesale" });
    expect(r.reason).toMatch(/ask the customer/i);
    expect(r.reason).toMatch(/has not/i);
  });

  it("accepts a Maldivian number however it is written", async () => {
    for (const phone of ["7712345", "+960 771-2345", "960 7712345"]) {
      expect((await escalate({ question: "wholesale", phone })).sent).toBe(true);
    }
  });
});
