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

async function parseXlsx(bytes: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    // row.values is 1-based with a leading hole; slice(1) drops it.
    const values = (row.values as unknown[]).slice(1);
    rows.push(values.map((v) => cellToString(v)));
  });
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
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

function toQty(raw: string): number {
  // Tolerates "12 pcs", "1,200", " 5.0 ".
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function detectColumns(header: string[]) {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h.trim()));
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

type CatalogueProduct = { id: string; name: string; sku: string };

function buildIndex(products: CatalogueProduct[]) {
  const bySku = new Map<string, CatalogueProduct>();
  const byName = new Map<string, CatalogueProduct[]>();
  for (const p of products) {
    if (p.sku) bySku.set(normalizeName(p.sku), p);
    const key = normalizeName(p.name);
    const list = byName.get(key) ?? [];
    list.push(p);
    byName.set(key, list);
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
    const candidates = products.filter((p) => {
      const pn = normalizeName(p.name);
      return pn.includes(norm) || norm.includes(pn);
    });
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

  let grid: string[][];
  try {
    grid = /\.csv$/i.test(params.fileName) || params.contentType === "text/csv"
      ? parseCsv(params.bytes.toString("utf8"))
      : await parseXlsx(params.bytes);
  } catch {
    return { ...empty, problem: "That file couldn't be read as a spreadsheet." };
  }

  if (grid.length < 2) return { ...empty, problem: "That sheet has no rows under its header." };

  const header = grid[0];
  const { nameIdx, expectedIdx, receivedIdx, faultyIdx } = detectColumns(header);
  if (nameIdx === -1) {
    return { ...empty, problem: "No product-name column found. Name one column Product, Item, or Description." };
  }
  if (expectedIdx === -1 && receivedIdx === -1) {
    return { ...empty, problem: "No quantity column found. Name one column Qty or Quantity." };
  }

  const index = buildIndex(params.products);
  const matched: MatchedLine[] = [];
  const unmatched: ImportPreview["unmatched"] = [];
  // A supplier sheet can list the same product on more than one line (two
  // cartons, two batches); those are summed onto one shipment line, since
  // stock_shipment_items is unique per (shipment, product).
  const seen = new Map<string, MatchedLine>();

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const name = (row[nameIdx] ?? "").trim();
    if (!name) continue;

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
