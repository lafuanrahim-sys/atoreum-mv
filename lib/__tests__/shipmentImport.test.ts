import { describe, it, expect } from "vitest";
import { buildImportPreview } from "@/lib/data/shipmentImport.server";

/**
 * The shapes real supplier paperwork actually arrives in.
 *
 * Each case here is a way the import silently returned nothing before: the
 * item list on a later worksheet, column headings below a letterhead, and a
 * supplier naming a product differently from the catalogue. "Silently" is the
 * problem — a failed import looks identical to an empty packing list.
 */
const CATALOGUE = [
  { id: "fom-006", name: "Lebelage Aloe Bubble Chewy Foam", sku: "LBL-FOM-006", brand: "Lebelage", size: "200ml" },
  { id: "crm-014", name: "Lebelage Dr. Aqua Cure Cream", sku: "LBL-CRM-014", brand: "Lebelage", size: "70ml" },
  { id: "ser-001", name: "Lebelage Truly Glutathione Serum", sku: "LBL-SER-001", brand: "Lebelage", size: "30ml" },
];

const csv = (text: string) =>
  buildImportPreview({
    bytes: Buffer.from(text, "utf8"),
    fileName: "packing.csv",
    contentType: "text/csv",
    products: CATALOGUE,
  });

describe("packing list import", () => {
  it("reads a plain product/qty sheet", async () => {
    const r = await csv("Product,Qty\nLebelage Aloe Bubble Chewy Foam,4\n");
    expect(r.problem).toBeNull();
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({ productId: "fom-006", qtyExpected: 4 });
  });

  it("finds the header below a letterhead", async () => {
    // A commercial invoice opens with the supplier's details, not the table.
    const r = await csv(
      [
        "LEBELAGE CO. LTD",
        "Commercial Invoice,2026.07.20",
        "Consignee,Aranzo Investments",
        "",
        "Item,Qty",
        "Lebelage Aloe Bubble Chewy Foam,4",
      ].join("\n")
    );
    expect(r.problem).toBeNull();
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].qtyExpected).toBe(4);
  });

  it("matches a supplier name that drops the brand and appends the size", async () => {
    // How this supplier actually writes it: no "Lebelage" (the whole invoice
    // is Lebelage), size appended. Neither string contains the other, so
    // plain containment matching failed on nearly every line.
    const r = await csv("Product,Qty\nAloe Bubble Chewy Foam 200ml,4\n");
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].productId).toBe("fom-006");
  });

  it("matches on SKU", async () => {
    const r = await csv("Item,Quantity\nLBL-SER-001,12\n");
    expect(r.matched[0]).toMatchObject({ productId: "ser-001", qtyExpected: 12 });
  });

  it("ignores the sheet's own totals line", async () => {
    // Left in, it lands in "unmatched" carrying the largest quantity on the
    // sheet and reads as though the import missed the most important row.
    const r = await csv("Product,Qty\nAloe Bubble Chewy Foam 200ml,4\nTOTAL  -  89 line items,422\n");
    expect(r.matched).toHaveLength(1);
    expect(r.unmatched).toHaveLength(0);
  });

  it("sums a product listed on two lines", async () => {
    const r = await csv("Product,Qty\nAloe Bubble Chewy Foam 200ml,4\nLebelage Aloe Bubble Chewy Foam,3\n");
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].qtyExpected).toBe(7);
  });

  it("reports a genuinely unknown product instead of guessing", async () => {
    // The one thing worse than importing nothing is importing stock against
    // the wrong product.
    const r = await csv("Product,Qty\nSome Other Brand Night Mask,5\n");
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched).toEqual([{ rowNumber: 2, name: "Some Other Brand Night Mask", qty: 5 }]);
  });

  it("separates received and faulty when the sheet distinguishes them", async () => {
    const r = await csv("Product,Ordered,Received,Damaged\nAloe Bubble Chewy Foam 200ml,10,9,1\n");
    expect(r.matched[0]).toMatchObject({ qtyExpected: 10, qtyReceived: 9, qtyFaulty: 1 });
  });

  it("says what is missing when there are no usable columns", async () => {
    const r = await csv("Invoice No,Date\nINV-1,2026-07-20\n");
    expect(r.matched).toHaveLength(0);
    expect(r.problem).toMatch(/Product, Item, or Description/);
  });

  it("leaves a PDF alone rather than calling it a broken sheet", async () => {
    const r = await buildImportPreview({
      bytes: Buffer.from("%PDF-1.7"),
      fileName: "2026.07.20 Commercial Invoice.pdf",
      contentType: "application/pdf",
      products: CATALOGUE,
    });
    expect(r.notASheet).toBe(true);
    expect(r.problem).toBeNull();
  });
});
