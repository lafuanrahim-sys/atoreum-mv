import { describe, it, expect } from "vitest";
import { buildInvoice, GST_RATE } from "@/lib/invoice";
import { renderOrderTelegramMessage } from "@/lib/notify";
import type { Order } from "@/lib/types";

/**
 * GST arithmetic, locked down, because these figures are filed with MIRA.
 *
 * The rule that matters and is easiest to break silently: a discount reduces
 * the TAXABLE VALUE. Sangu and gift vouchers both come off before the tax is
 * extracted. Applying them after would overstate output tax on every
 * discounted order — MVR 3.71 on the order below — and the shop would be
 * paying that difference itself.
 */
function order(over: Partial<Order> = {}): Order {
  return {
    id: "x",
    orderNumber: "ATM-TEST-0001",
    invoiceSeq: 1,
    invoiceSeries: "INV",
    movesStock: true,
    items: [
      { productId: "amp-009", name: "24K Gold Perfect Ampoule", price: 750, currency: "MVR", quantity: 2, image: null },
      { productId: "crm-010", name: "Real Sensation Blemish Cream", price: 600, currency: "MVR", quantity: 1, image: null },
    ],
    subtotal: 2100,
    currency: "MVR",
    customer: { name: "Test Customer", email: "t@example.com", phone: "779 1234", address: "Malé, Maldives" },
    paymentMethod: "transfer",
    paymentProofPath: null,
    status: "Pending Verification",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    ...over,
  } as Order;
}

describe("invoice GST", () => {
  it("extracts GST from the total rather than adding it on", () => {
    const i = buildInvoice(order());
    expect(i.grossTotal).toBe(2100);
    expect(i.netTotal).toBe(1944.44);
    expect(i.gstTotal).toBe(155.56);
  });

  it("always reconciles: taxable value + GST equals the total", () => {
    for (const o of [
      order(),
      order({ boliRedeemed: 5000, boliDiscountAmount: 50 }),
      order({ voucherCode: "ATO-X", voucherBoli: 10000, voucherDiscountAmount: 100 }),
      order({ boliRedeemed: 5000, boliDiscountAmount: 50, voucherCode: "ATO-X", voucherBoli: 10000, voucherDiscountAmount: 100 }),
    ]) {
      const i = buildInvoice(o);
      expect(Math.round((i.netTotal + i.gstTotal) * 100) / 100).toBe(i.grossTotal);
    }
  });

  it("takes Sangu off before the tax, not after", () => {
    const i = buildInvoice(order({ boliRedeemed: 5000, boliDiscountAmount: 50 }));
    expect(i.grossTotal).toBe(2050);
    expect(i.gstTotal).toBe(151.85);
    // Taxing the pre-discount 2,100 would have produced 155.56.
    const ifTaxedBeforeDiscount = Math.round((2100 - 2100 / (1 + GST_RATE)) * 100) / 100;
    expect(i.gstTotal).toBeLessThan(ifTaxedBeforeDiscount);
  });

  it("takes a gift voucher off the taxable value too", () => {
    // A voucher is money already paid to the shop. Leaving it in the taxable
    // value meant remitting 8% of it out of the shop's own pocket.
    const i = buildInvoice(order({ voucherCode: "ATO-X", voucherBoli: 10000, voucherDiscountAmount: 100 }));
    expect(i.voucherApplied).toBe(100);
    expect(i.grossTotal).toBe(2000);
    expect(i.gstTotal).toBe(148.15);
  });

  it("never charges below zero, however much is applied", () => {
    const i = buildInvoice(order({ voucherCode: "ATO-X", voucherBoli: 999999, voucherDiscountAmount: 9999 }));
    expect(i.grossTotal).toBe(0);
    expect(i.gstTotal).toBe(0);
  });
});

describe("order notification", () => {
  it("reads as a sum that reconciles", () => {
    // The lines used to run Subtotal, Sangu, GST, Total -- which reads as
    // 2,100 - 50 + 151.85 = 2,201.85 against a total of 2,050, and looks
    // broken to anyone glancing at their phone.
    const message = renderOrderTelegramMessage(order({ boliRedeemed: 5000, boliDiscountAmount: 50 }));
    const subtotal = message.indexOf("Subtotal");
    const sangu = message.indexOf("Sangu:");
    const total = message.indexOf("Total:");
    const gst = message.indexOf("of which GST");

    expect(message).toContain("Subtotal (incl. GST)");
    expect(sangu).toBeGreaterThan(subtotal);
    expect(total).toBeGreaterThan(sangu);
    // GST last, presented as part of the total rather than added to it.
    expect(gst).toBeGreaterThan(total);
  });
});
