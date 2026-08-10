import type { Order } from "@/lib/types";

/**
 * Invoice arithmetic, in one place, because it is submitted to MIRA.
 *
 * The prices this store lists are GST-INCLUSIVE. That is not an assumption:
 * the owner's pricing workbook computes each product as
 * "Selling price w/o GST" + "GST 8%" = "Total Selling Price / Unit", and the
 * listing price imported into the catalogue is that last column. Checked
 * against all 90 rows of the sheet -- every one sums, and every one implies
 * exactly 8%.
 *
 * So GST is EXTRACTED from the charged amount, never added on top:
 *
 *     net = gross / 1.08
 *     gst = gross - net
 *
 * Adding 8% on top instead would overstate output tax by 8% of the whole
 * invoice and hand the customer a total they never agreed to pay.
 */
export const GST_RATE = 0.08;

/** Round to laari. Every figure on an invoice is rounded exactly once, here. */
function toLaari(value: number): number {
  return Math.round(value * 100) / 100;
}

export type InvoiceLine = {
  productId: string;
  name: string;
  quantity: number;
  /** GST-inclusive unit price, as charged. */
  unitGross: number;
  /** GST-inclusive line total. */
  lineGross: number;
  /** Line total excluding GST. */
  lineNet: number;
  /** GST contained within lineGross. */
  lineGst: number;
};

export type Invoice = {
  lines: InvoiceLine[];
  /** Sum of line totals, GST-inclusive, before any discount. */
  grossSubtotal: number;
  /** Sangu redemption applied at checkout, GST-inclusive. */
  discount: number;
  /** What the customer actually pays, GST-inclusive. */
  grossTotal: number;
  /** grossTotal excluding GST -- the taxable value. */
  netTotal: number;
  /** GST contained within grossTotal. */
  gstTotal: number;
  currency: string;
  gstRatePercent: number;
};

/**
 * A Sangu discount reduces the money that changes hands, so it reduces the
 * taxable value with it -- GST is charged on consideration received, not on
 * list price. It is therefore applied to the gross total FIRST and the tax
 * extracted from the discounted figure, rather than summing the per-line GST.
 *
 * The per-line net/GST columns are still shown, because an invoice has to
 * itemise, but they are presented against the undiscounted lines and the
 * discount appears as its own row. Summing the line GST would disagree with
 * gstTotal by the tax on the discount; that difference is the discount's own
 * tax, and it is accounted for on the discount line, not lost.
 */
export function buildInvoice(order: Order): Invoice {
  const lines: InvoiceLine[] = order.items.map((item) => {
    const lineGross = toLaari(item.price * item.quantity);
    const lineNet = toLaari(lineGross / (1 + GST_RATE));
    return {
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitGross: item.price,
      lineGross,
      lineNet,
      // Derived by subtraction, not by a second division, so net + gst is
      // always exactly the line total with no rounding drift.
      lineGst: toLaari(lineGross - lineNet),
    };
  });

  const grossSubtotal = toLaari(lines.reduce((sum, l) => sum + l.lineGross, 0));
  const discount = toLaari(order.boliDiscountAmount ?? 0);
  const grossTotal = toLaari(Math.max(0, grossSubtotal - discount));
  const netTotal = toLaari(grossTotal / (1 + GST_RATE));

  return {
    lines,
    grossSubtotal,
    discount,
    grossTotal,
    netTotal,
    gstTotal: toLaari(grossTotal - netTotal),
    currency: order.currency,
    gstRatePercent: GST_RATE * 100,
  };
}

/** `MVR 1,234.00` — one formatter so the page and the email can't diverge. */
export function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * `ATO-INV-0001`, from the order's own monotonic invoice_seq.
 *
 * Not derived from orderNumber: that counter resets each day, so two orders a
 * week apart would both render as ATO-INV-0001. A tax invoice reference has to
 * be unique for the life of the business, so it gets its own sequence, handed
 * out by the database at insert (see lib/data/schema.sql).
 *
 * Padded to four digits for legibility and allowed to run past it -- the
 * 10,000th invoice prints as ATO-INV-10000 rather than wrapping.
 */
export function invoiceNumber(order: Order): string {
  return `ATO-INV-${String(order.invoiceSeq).padStart(4, "0")}`;
}
