import ExcelJS from "exceljs";

/**
 * Reads a supplier's packing list or invoice (CSV or Excel) and turns it
 * into shipment lines, matching each row to a product in the catalogue.
 *
 * Matching is deliberately conservative: a row is only attached to a product
 * on an exact identifier match (SKU, or the product name once normalised) or
 * an unambiguous containment match. Anything else is returned as UNMATCHED
 * for a human to look at, because a wrong guess here silently books stock
 * against the wrong product -- far worse than asking.
 */

export type ParsedSheetRow = {
  rowNumber: number;
  name: string;
  qtyExpected: number;
  qtyReceived: number | null;
  qtyFaulty: number | null;
};

export type MatchedLine = {
  productId: string;
  productName: string;
  sku: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyFaulty: number;
  sourceName: string;
};

export type ImportPreview = {
  matched: MatchedLine[];
  unmatched: { rowNumber: number; name: string; qty: number }[];
  /** True when the file simply isn't a spreadsheet (a PDF invoice, a photo) -- not an error, just nothing to import. */
  notASheet: boolean;
  /** Set when the file IS a sheet but no usable columns were found. */
  problem: string | null;
};

const SHEET_EXT = /\.(csv|xlsx|xls)$/i;
const SHEET_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function looksLikeSheet(fileName: string, contentType: string): boolean {
  return SHEET_EXT.test(fileName) || SHEET_TYPES.includes(contentType);
}

/* ------------------------------- csv parsing ------------------------------ */

/**
 * Minimal RFC-4180-ish CSV reader: quoted fields, embedded commas and
 * newlines, and "" as an escaped quote. Hand-rolled rather than pulling in
 * another dependency for what is a well-defined 40-line problem.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM, which Excel writes and which would otherwise become
  // part of the first header cell and break column detection.
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type NamedGrid = { sheetName: string; grid: string[][] };

/**
 * Every worksheet, not just the first.
 *
 * Reading only worksheets[0] is what broke this on real supplier files: the
 * workbook that ships this catalogue opens on a "Costs" tab, with the actual
 * item list on the third sheet. The first tab has no product column, so the
 * import gave up with "No product-name column found" on a workbook that
 * plainly contained one.
 */
async function parseXlsx(bytes: Buffer): Promise<NamedGrid[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      // row.values is 1-based with a leading hole; slice(1) drops it.
      const values = (row.values as unknown[]).slice(1);
      // Array.from, not map: a row with blank cells is a SPARSE array, and
      // map preserves the holes, leaving undefined in the "string[]".
      rows.push(Array.from(values, (v) => cellToString(v)));
    });
    return {
      sheetName: sheet.name,
      grid: rows.filter((r) => r.some((c) => c.trim() !== "")),
    };
  });
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (typeof v.text === "string") return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return cellToString(v.result);
  }
  return String(value);
}

/* ---------------------------- column detection ---------------------------- */

const NAME_HEADER = /^(product|item|description|name|goods|particulars)/i;
const EXPECTED_HEADER = /(expected|ordered|order\s*qty|shipped|invoice\s*qty)/i;
const RECEIVED_HEADER = /(received|delivered|arrived|actual)/i;
const FAULTY_HEADER = /(faulty|damaged|broken|defect|reject)/i;
const QTY_HEADER = /(qty|quantity|units|pcs|pieces|count)/i;

/**
 * A sheet's own totals line, not a product.
 *
 * Left unfiltered it lands in "unmatched" with the biggest quantity on the
 * sheet, which reads as though the import missed the most important row. It
 * cannot collide with a real product: nothing in the catalogue is called
 * "Total ...".
 */
const SUMMARY_ROW = /^(total|totals|subtotal|sub total|grand total|sum)\b/i;

function toQty(raw: string): number {
  // Tolerates "12 pcs", "1,200", " 5.0 ".
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/**
 * How many rows below `headerRow` actually look like line items.
 *
 * Used to choose between candidate header rows and between worksheets: a
 * commercial invoice has letterhead, addresses and totals around the real
 * table, and several rows can look header-ish. The one with the most usable
 * items under it is the table.
 */
function countDataRows(grid: string[][], headerRow: number, cols: ReturnType<typeof detectColumns>): number {
  let n = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i];
    const name = (row[cols.nameIdx] ?? "").trim();
    if (!name) continue;
    const qty =
      (cols.expectedIdx >= 0 ? toQty(row[cols.expectedIdx] ?? "") : 0) +
      (cols.receivedIdx >= 0 ? toQty(row[cols.receivedIdx] ?? "") : 0) +
      (cols.faultyIdx >= 0 ? toQty(row[cols.faultyIdx] ?? "") : 0);
    if (qty > 0) n++;
  }
  return n;
}

/** How far down a sheet to look for the header row before giving up. */
const HEADER_SCAN_ROWS = 25;

/**
 * Find the header row and its columns, anywhere in the top of the sheet.
 *
 * The old code assumed row 1. Real paperwork almost never does: a commercial
 * invoice opens with the supplier's name, an invoice number and dates, and
 * the column headings appear well down the page.
 */
function findTable(grid: string[][]) {
  let best: { headerRow: number; cols: ReturnType<typeof detectColumns>; rows: number } | null = null;
  const limit = Math.min(grid.length - 1, HEADER_SCAN_ROWS);
  for (let r = 0; r < limit; r++) {
    const cols = detectColumns(grid[r]);
    if (cols.nameIdx === -1) continue;
    if (cols.expectedIdx === -1 && cols.receivedIdx === -1) continue;
    const rows = countDataRows(grid, r, cols);
    if (rows > 0 && (!best || rows > best.rows)) best = { headerRow: r, cols, rows };
  }
  return best;
}

function detectColumns(header: string[]) {
  // (h ?? ""): rows are ragged in practice -- a short row, or a hole left by a
  // blank cell -- and a header scan must survive them rather than throw.
  const find = (re: RegExp) => header.findIndex((h) => re.test((h ?? "").trim()));
  const nameIdx = find(NAME_HEADER);
  const faultyIdx = find(FAULTY_HEADER);
  const receivedIdx = find(RECEIVED_HEADER);
  let expectedIdx = find(EXPECTED_HEADER);
  // A sheet with a single generic "Qty" column means "what the supplier says
  // they sent" -- that's the EXPECTED quantity. Received and faulty are only
  // known once someone opens the box, so they stay for the human to fill in.
  if (expectedIdx === -1) {
    const generic = header.findIndex((h, i) => QTY_HEADER.test(h.trim()) && i !== faultyIdx && i !== receivedIdx);
    expectedIdx = generic;
  }
  return { nameIdx, expectedIdx, receivedIdx, faultyIdx };
}

/* -------------------------------- matching -------------------------------- */

/** Lowercase, strip accents and punctuation, collapse whitespace. "Lebelage Dr. Aqua-Cure Cream" -> "lebelage dr aqua cure cream". */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CatalogueProduct = { id: string; name: string; sku: string; brand?: string; size?: string };

/**
 * Every string this product could plausibly be called on a supplier's sheet.
 *
 * Suppliers do not write the catalogue's name. This one invoices
 * "Aloe Bubble Chewy Foam 200ml" for what the shop lists as "Lebelage Aloe
 * Bubble Chewy Foam" -- the brand is dropped (their whole invoice is that
 * brand) and the size is appended (it is how they identify the SKU). Neither
 * string contains the other, so the old containment test failed on nearly
 * every line of a real packing list.
 *
 * Rather than loosen matching -- which risks booking stock against the wrong
 * product -- each product gets a small set of EXACT aliases, and matching
 * stays exact against those.
 */
function aliasesFor(p: CatalogueProduct): string[] {
  const name = normalizeName(p.name);
  const size = normalizeName(p.size ?? "");
  const brand = normalizeName(p.brand ?? "");
  // "lebelage aloe bubble chewy foam" -> "aloe bubble chewy foam"
  const brandless = brand && name.startsWith(`${brand} `) ? name.slice(brand.length + 1) : name;

  const out = [name, brandless];
  if (size) {
    out.push(`${name} ${size}`, `${brandless} ${size}`);
  }
  return [...new Set(out.filter(Boolean))];
}

function buildIndex(products: CatalogueProduct[]) {
  const bySku = new Map<string, CatalogueProduct>();
  const byName = new Map<string, CatalogueProduct[]>();
  const push = (key: string, p: CatalogueProduct) => {
    const list = byName.get(key) ?? [];
    // Guard against one product registering the same alias twice (a product
    // with no size produces name === name+size), which would otherwise look
    // like an ambiguous two-product collision and block the match.
    if (!list.some((x) => x.id === p.id)) list.push(p);
    byName.set(key, list);
  };
  for (const p of products) {
    if (p.sku) bySku.set(normalizeName(p.sku), p);
    for (const alias of aliasesFor(p)) push(alias, p);
  }
  return { bySku, byName };
}

function matchOne(rawName: string, products: CatalogueProduct[], index: ReturnType<typeof buildIndex>): CatalogueProduct | null {
  const norm = normalizeName(rawName);
  if (!norm) return null;

  const bySku = index.bySku.get(norm);
  if (bySku) return bySku;

  const exact = index.byName.get(norm);
  // Ambiguous exact matches (two products with the same normalised name) are
  // treated as no match rather than picking one arbitrarily.
  if (exact && exact.length === 1) return exact[0];
  if (exact && exact.length > 1) return null;

  // Containment, but only when it's unambiguous across the whole catalogue
  // and the shorter string is substantial enough not to match half the shop
  // (e.g. the bare word "cream").
  if (norm.length >= 6) {
    const candidates = products.filter((p) =>
      aliasesFor(p).some((alias) => alias.includes(norm) || norm.includes(alias))
    );
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

/* --------------------------------- entry ---------------------------------- */

export async function buildImportPreview(params: {
  bytes: Buffer;
  fileName: string;
  contentType: string;
  products: CatalogueProduct[];
}): Promise<ImportPreview> {
  const empty: ImportPreview = { matched: [], unmatched: [], notASheet: false, problem: null };
  if (!looksLikeSheet(params.fileName, params.contentType)) {
    return { ...empty, notASheet: true };
  }

  let sheets: NamedGrid[];
  try {
    sheets = /\.csv$/i.test(params.fileName) || params.contentType === "text/csv"
      ? [{ sheetName: "", grid: parseCsv(params.bytes.toString("utf8")) }]
      : await parseXlsx(params.bytes);
  } catch {
    return { ...empty, problem: "That file couldn't be read as a spreadsheet." };
  }

  // Whichever sheet holds the most line items is the packing list. A workbook
  // routinely carries costing and working tabs alongside it, and the item
  // list is not reliably the first one.
  let chosen: { sheet: NamedGrid; table: NonNullable<ReturnType<typeof findTable>> } | null = null;
  for (const sheet of sheets) {
    if (sheet.grid.length < 2) continue;
    const table = findTable(sheet.grid);
    if (table && (!chosen || table.rows > chosen.table.rows)) chosen = { sheet, table };
  }

  if (!chosen) {
    const looked = sheets.map((s) => s.sheetName).filter(Boolean);
    return {
      ...empty,
      problem:
        `No product and quantity columns found${looked.length > 1 ? ` on any sheet (${looked.join(", ")})` : ""}. ` +
        `Name one column Product, Item, or Description, and one Qty or Quantity.`,
    };
  }

  const grid = chosen.sheet.grid;
  const headerRow = chosen.table.headerRow;
  const { nameIdx, expectedIdx, receivedIdx, faultyIdx } = chosen.table.cols;

  const index = buildIndex(params.products);
  const matched: MatchedLine[] = [];
  const unmatched: ImportPreview["unmatched"] = [];
  // A supplier sheet can list the same product on more than one line (two
  // cartons, two batches); those are summed onto one shipment line, since
  // stock_shipment_items is unique per (shipment, product).
  const seen = new Map<string, MatchedLine>();

  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i];
    const name = (row[nameIdx] ?? "").trim();
    if (!name) continue;
    if (SUMMARY_ROW.test(name)) continue;

    const expected = expectedIdx >= 0 ? toQty(row[expectedIdx] ?? "") : 0;
    const received = receivedIdx >= 0 ? toQty(row[receivedIdx] ?? "") : 0;
    const faulty = faultyIdx >= 0 ? toQty(row[faultyIdx] ?? "") : 0;
    if (expected === 0 && received === 0 && faulty === 0) continue;

    const product = matchOne(name, params.products, index);
    if (!product) {
      unmatched.push({ rowNumber: i + 1, name, qty: expected || received });
      continue;
    }

    const existing = seen.get(product.id);
    if (existing) {
      existing.qtyExpected += expected;
      existing.qtyReceived += received;
      existing.qtyFaulty += faulty;
    } else {
      const line: MatchedLine = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        qtyExpected: expected,
        qtyReceived: received,
        qtyFaulty: faulty,
        sourceName: name,
      };
      seen.set(product.id, line);
      matched.push(line);
    }
  }

  return { matched, unmatched, notASheet: false, problem: null };
}
