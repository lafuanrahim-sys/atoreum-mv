import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { Product } from "@/lib/types";
import { EMPTY_FILTERS, filterProducts } from "@/lib/dashboard/productFilters";
import { buildInventoryWorkbook, HEADER_ROW, inventoryFilename } from "@/lib/dashboard/productExport";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "msk-001",
    sku: "LBL-MSK-001",
    name: "Lebelage Cica Solution Mask Pack",
    size: "25g x 10pcs",
    brand: "Lebelage",
    category: "Mask Pack",
    price: 230,
    priceMin: 180,
    priceMedian: 250,
    priceMax: 300,
    discountPercent: 10,
    discountAmount: 0,
    priceEffective: 207,
    currency: "MVR",
    imageHasBackground: false,
    description: "",
    headlines: ["", "", ""],
    ingredients: "",
    howToUse: "",
    images: ["/x.png"],
    stockStatus: "in-stock",
    stockOnHand: 8,
    featured: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
    ...overrides,
  };
}

async function reopen(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer as ArrayBuffer);
  return reopened.getWorksheet("Inventory")!;
}

describe("buildInventoryWorkbook", () => {
  it("writes one row per product, with the pricing columns intact", async () => {
    const rows = [product(), product({ id: "msk-002", sku: "LBL-MSK-002", name: "Snail", stockOnHand: 0 })];
    const sheet = await reopen(
      buildInventoryWorkbook({ rows, totalCount: 2, filters: EMPTY_FILTERS, exportedBy: "a@b.mv" }),
    );

    const first = sheet.getRow(HEADER_ROW + 1);
    expect(first.getCell(1).value).toBe("LBL-MSK-001");
    expect(first.getCell(7).value).toBe(180); // floor
    expect(first.getCell(8).value).toBe(230); // listing
    expect(first.getCell(9).value).toBe(10); // discount %
    expect(first.getCell(11).value).toBe(207); // charged
    expect(first.getCell(14).value).toBe(8); // on hand

    // Stock value is a live formula, not a baked number.
    expect((first.getCell(15).value as ExcelJS.CellFormulaValue).formula).toBe("K7*N7");
  });

  it("totals on hand and stock value across the exported rows", async () => {
    const rows = [product(), product({ id: "msk-002", sku: "LBL-MSK-002", stockOnHand: 12 })];
    const sheet = await reopen(
      buildInventoryWorkbook({ rows, totalCount: 2, filters: EMPTY_FILTERS, exportedBy: "a@b.mv" }),
    );

    const totalRow = sheet.getRow(HEADER_ROW + rows.length + 1);
    expect(totalRow.getCell(2).value).toBe("TOTAL — 2 products");
    expect((totalRow.getCell(14).value as ExcelJS.CellFormulaValue).formula).toBe("SUM(N7:N8)");
    expect((totalRow.getCell(15).value as ExcelJS.CellFormulaValue).formula).toBe("SUM(O7:O8)");
  });

  it("records which filters produced the file, and the subset size", async () => {
    const all = [
      product(),
      product({ id: "crm-001", sku: "LBL-CRM-001", category: "Cream", discountPercent: 0, priceEffective: 230 }),
    ];
    const filters = { ...EMPTY_FILTERS, category: "Mask Pack", offer: "on" };
    const rows = filterProducts(all, filters);
    expect(rows).toHaveLength(1);

    const sheet = await reopen(
      buildInventoryWorkbook({ rows, totalCount: all.length, filters, exportedBy: "a@b.mv" }),
    );
    expect(String(sheet.getCell("A3").value)).toContain("category Mask Pack");
    expect(String(sheet.getCell("A3").value)).toContain("on offer");
    expect(sheet.getCell("A4").value).toBe("1 of 2 products");
  });

  it("survives an empty result set without writing a broken autofilter", async () => {
    const workbook = buildInventoryWorkbook({
      rows: [],
      totalCount: 9,
      filters: { ...EMPTY_FILTERS, q: "nothing" },
      exportedBy: "a@b.mv",
    });
    const sheet = await reopen(workbook);
    expect(sheet.getRow(HEADER_ROW + 1).getCell(2).value).toBe("TOTAL — 0 products");
  });

  it("names the file by the Maldives calendar day, not UTC", () => {
    // 21:30 UTC is already the next day in Malé (UTC+5).
    expect(inventoryFilename(new Date("2026-11-22T21:30:00Z"))).toBe("atoreum-inventory-2026-11-23.xlsx");
  });
});
