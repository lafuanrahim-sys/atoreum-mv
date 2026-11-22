import ExcelJS from "exceljs";
import type { Product } from "@/lib/types";
import { describeFilters, type ProductFilters } from "@/lib/dashboard/productFilters";

/**
 * Builds the dashboard's inventory workbook.
 *
 * Separate from the route handler that serves it so the sheet can be built
 * and inspected in a test without a database, a session or an HTTP request
 * (see lib/dashboard/productExport.test.ts).
 */

const BRAND_INK = "FF14110F";
const BRAND_IVORY = "FFE9BAA6";
const BRAND_SAGE = "FF6F8D86";
const ROW_TINT = "FFF4F2EE";
const TOTAL_TINT = "FFE4EBE9";
const MUTED = "FF7A7A7A";

/** Header row index. Everything below it is data; the four rows above are the masthead. */
export const HEADER_ROW = 6;

type Column = { header: string; key: string; width: number; numFmt?: string };

const COLUMNS: Column[] = [
  { header: "SKU", key: "sku", width: 16 },
  { header: "Product Name", key: "name", width: 44 },
  { header: "Size", key: "size", width: 14 },
  { header: "Brand", key: "brand", width: 12 },
  { header: "Category", key: "category", width: 16 },
  { header: "Currency", key: "currency", width: 9 },
  { header: "Floor\n(min)", key: "priceMin", width: 11, numFmt: "#,##0.00" },
  { header: "Listing\nPrice", key: "price", width: 11, numFmt: "#,##0.00" },
  { header: "Discount\n%", key: "discountPercent", width: 10, numFmt: "0.##" },
  { header: "Discount\nAmount", key: "discountAmount", width: 11, numFmt: "#,##0.00" },
  { header: "Price\nCharged", key: "priceEffective", width: 12, numFmt: "#,##0.00" },
  { header: "Median\n(ref)", key: "priceMedian", width: 11, numFmt: "#,##0.00" },
  { header: "Max\n(ref)", key: "priceMax", width: 11, numFmt: "#,##0.00" },
  { header: "On Hand", key: "stockOnHand", width: 9, numFmt: "#,##0" },
  { header: "Stock Value\n(charged)", key: "stockValue", width: 14, numFmt: "#,##0.00" },
  { header: "Stock Status", key: "stockStatus", width: 14 },
  { header: "Featured", key: "featured", width: 10 },
  { header: "Last Updated", key: "updatedAt", width: 13 },
];

/** Column letters used in formulas, derived once so a reorder can't desync them. */
const PRICE_CHARGED_COL = "K"; // priceEffective
const ON_HAND_COL = "N"; // stockOnHand
const STOCK_VALUE_COL = "O"; // stockValue

/** Maldives time, so the stamp in the file matches the day the admin ran it. */
export function maldivesTimestamp(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Indian/Maldives",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function maldivesDateStamp(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Maldives",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function inventoryFilename(now: Date = new Date()): string {
  return `atoreum-inventory-${maldivesDateStamp(now)}.xlsx`;
}

export function buildInventoryWorkbook({
  rows,
  totalCount,
  filters,
  exportedBy,
  now = new Date(),
}: {
  rows: Product[];
  totalCount: number;
  filters: ProductFilters;
  exportedBy: string;
  now?: Date;
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Atoreum MV";
  workbook.created = now;

  const sheet = workbook.addWorksheet("Inventory", {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  const lastColumnLetter = sheet.getColumn(COLUMNS.length).letter;

  const masthead: Array<{ text: string; style: Partial<ExcelJS.Font> }> = [
    {
      text: "ATOREUM MV  —  Inventory & Pricing",
      style: { size: 15, bold: true, color: { argb: BRAND_INK } },
    },
    {
      text: `Exported ${maldivesTimestamp(now)} (Maldives time) by ${exportedBy}`,
      style: { size: 9, color: { argb: MUTED } },
    },
    {
      text: `Filters applied: ${describeFilters(filters)}`,
      style: { size: 9, italic: true, color: { argb: MUTED } },
    },
    {
      text:
        rows.length === totalCount
          ? `${totalCount} products`
          : `${rows.length} of ${totalCount} products`,
      style: { size: 9, color: { argb: MUTED } },
    },
  ];
  masthead.forEach(({ text, style }, index) => {
    const rowNumber = index + 1;
    sheet.mergeCells(`A${rowNumber}:${lastColumnLetter}${rowNumber}`);
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.value = text;
    cell.font = { name: "Arial", ...style };
  });

  const headerRow = sheet.getRow(HEADER_ROW);
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: BRAND_IVORY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_INK } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.height = 30;

  rows.forEach((product, index) => {
    const rowNumber = HEADER_ROW + 1 + index;
    const row = sheet.getRow(rowNumber);
    row.values = {
      sku: product.sku,
      name: product.name,
      size: product.size,
      brand: product.brand,
      category: product.category,
      currency: product.currency,
      priceMin: product.priceMin,
      price: product.price,
      discountPercent: product.discountPercent,
      discountAmount: product.discountAmount,
      priceEffective: product.priceEffective,
      priceMedian: product.priceMedian,
      priceMax: product.priceMax,
      stockOnHand: product.stockOnHand,
      // A formula rather than a computed number, so the sheet stays live if
      // the admin edits a price or a quantity in Excel to model a change.
      stockValue: { formula: `${PRICE_CHARGED_COL}${rowNumber}*${ON_HAND_COL}${rowNumber}` },
      stockStatus: product.stockStatus.replace(/-/g, " "),
      featured: product.featured ? "Yes" : "",
      updatedAt: product.updatedAt.slice(0, 10),
    } satisfies Record<string, ExcelJS.CellValue>;

    row.font = { name: "Arial", size: 9 };
    if (index % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_TINT } };
      });
    }
    COLUMNS.forEach((column, columnIndex) => {
      if (column.numFmt) row.getCell(columnIndex + 1).numFmt = column.numFmt;
    });
    // Zero on hand is the one thing worth seeing without reading the column.
    if (product.stockOnHand === 0) {
      row.getCell(14).font = { name: "Arial", size: 9, bold: true, color: { argb: "FFB00020" } };
    }
  });

  const lastDataRow = HEADER_ROW + rows.length;
  const totalRow = sheet.getRow(lastDataRow + 1);
  totalRow.getCell(2).value = `TOTAL — ${rows.length} product${rows.length === 1 ? "" : "s"}`;
  if (rows.length > 0) {
    totalRow.getCell(14).value = {
      formula: `SUM(${ON_HAND_COL}${HEADER_ROW + 1}:${ON_HAND_COL}${lastDataRow})`,
    };
    totalRow.getCell(15).value = {
      formula: `SUM(${STOCK_VALUE_COL}${HEADER_ROW + 1}:${STOCK_VALUE_COL}${lastDataRow})`,
    };
  }
  totalRow.getCell(14).numFmt = "#,##0";
  totalRow.getCell(15).numFmt = "#,##0.00";
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: BRAND_INK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_TINT } };
    cell.border = { top: { style: "thin", color: { argb: BRAND_SAGE } } };
  });

  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: lastDataRow, column: COLUMNS.length },
    };
  }

  return workbook;
}
