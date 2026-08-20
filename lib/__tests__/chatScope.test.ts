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
];

vi.mock("@/lib/data/orders.server", () => ({
  getAllOrders: async () => ORDERS,
}));
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: async () => true,
  escapeTelegramHtml: (s: string) => s,
  telegramConfigured: () => true,
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
