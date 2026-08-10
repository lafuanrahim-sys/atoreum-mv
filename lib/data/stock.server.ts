import { pool } from "@/lib/db";
import type { PoolClient } from "pg";

/**
 * Stock control data layer: shipments in, physical counts, and the movement
 * ledger that ties both to products.stock_on_hand (see the stock_* tables in
 * lib/data/schema.sql for why the ledger is the truth and stock_on_hand is a
 * cache).
 *
 * Every write that changes stock goes through recordMovement() inside a
 * transaction, so the ledger and the cached number can never disagree --
 * there is deliberately no path that bumps stock_on_hand on its own.
 */

export type StockMovementReason =
  | "shipment_received"
  | "count_adjustment"
  | "sale"
  | "sale_reversal"
  | "manual";

/* ------------------------------- movements ------------------------------- */

/**
 * Appends one movement and moves the cached on-hand number by the same
 * delta, in whatever transaction the caller is already running. Callers must
 * pass a client from an open transaction -- this is never safe to run
 * standalone, because the ledger row and the cache update have to land or
 * fail together.
 *
 * greatest(0, ...) floors the cache at zero (stock_on_hand is a non-negative
 * count) while the ledger row is written exactly as given, so an
 * over-deduction stays visible in the history rather than being silently
 * rewritten.
 */
export async function recordMovement(
  client: PoolClient,
  input: {
    productId: string;
    delta: number;
    reason: StockMovementReason;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    createdBy?: string | null;
  }
): Promise<void> {
  if (!Number.isInteger(input.delta) || input.delta === 0) return;
  await client.query(
    `insert into stock_movements (product_id, delta, reason, source_type, source_id, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.productId,
      input.delta,
      input.reason,
      input.sourceType ?? "",
      input.sourceId ?? "",
      input.note ?? "",
      input.createdBy ?? null,
    ]
  );
  await client.query(
    `update products set stock_on_hand = greatest(0, stock_on_hand + $2), updated_at = now() where id = $1`,
    [input.productId, input.delta]
  );
}

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  delta: number;
  reason: StockMovementReason;
  sourceType: string;
  sourceId: string;
  note: string;
  createdBy: string | null;
  createdAt: string;
};

export async function listMovementsForProduct(productId: string, limit = 50): Promise<StockMovement[]> {
  const { rows } = await pool().query(
    `select m.*, p.name as product_name
       from stock_movements m join products p on p.id = m.product_id
      where m.product_id = $1
      order by m.created_at desc
      limit $2`,
    [productId, limit]
  );
  return rows.map(mapMovement);
}

export async function listRecentMovements(limit = 40): Promise<StockMovement[]> {
  const { rows } = await pool().query(
    `select m.*, p.name as product_name
       from stock_movements m join products p on p.id = m.product_id
      order by m.created_at desc
      limit $1`,
    [limit]
  );
  return rows.map(mapMovement);
}

type MovementRow = {
  id: string;
  product_id: string;
  product_name: string;
  delta: number;
  reason: StockMovementReason;
  source_type: string;
  source_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

function mapMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    delta: Number(row.delta),
    reason: row.reason,
    sourceType: row.source_type,
    sourceId: row.source_id,
    note: row.note,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/* ------------------------------- shipments ------------------------------- */

export type ShipmentItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qtyExpected: number;
  qtyReceived: number;
  qtyFaulty: number;
  qtyGood: number;
  qtyShort: number;
  note: string;
  /**
   * Read live from the products table on every load, not stored on the line.
   * That's what "price as per the products section" means here: change a
   * price on a product and every shipment's value follows it. The trade-off
   * is that a historical shipment is valued at today's price, not the price
   * that applied when it landed -- fine while this is a stock-value view
   * rather than an accounting record.
   */
  unitPrice: number;
  currency: string;
  lineValue: number;
};

export type Shipment = {
  id: string;
  reference: string;
  supplier: string;
  shippedDate: string | null;
  receivedDate: string | null;
  status: "draft" | "received";
  notes: string;
  createdBy: string | null;
  createdAt: string;
  items: ShipmentItem[];
  files: ShipmentFile[];
  totalExpected: number;
  totalReceived: number;
  totalFaulty: number;
  totalGood: number;
};

export type ShipmentFile = {
  id: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
};

export type ShipmentSummary = Omit<Shipment, "items" | "files">;

function summaryFromRow(row: {
  id: string;
  reference: string;
  supplier: string;
  shipped_date: string | null;
  received_date: string | null;
  status: "draft" | "received";
  notes: string;
  created_by: string | null;
  created_at: string;
  total_expected: string | null;
  total_received: string | null;
  total_faulty: string | null;
  total_good: string | null;
}): ShipmentSummary {
  return {
    id: row.id,
    reference: row.reference,
    supplier: row.supplier,
    shippedDate: row.shipped_date,
    receivedDate: row.received_date,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    totalExpected: Number(row.total_expected ?? 0),
    totalReceived: Number(row.total_received ?? 0),
    totalFaulty: Number(row.total_faulty ?? 0),
    totalGood: Number(row.total_good ?? 0),
  };
}

const SHIPMENT_TOTALS_SQL = `
  coalesce(sum(i.qty_expected), 0) as total_expected,
  coalesce(sum(i.qty_received), 0) as total_received,
  coalesce(sum(i.qty_faulty), 0) as total_faulty,
  coalesce(sum(i.qty_good), 0) as total_good`;

export async function listShipments(): Promise<ShipmentSummary[]> {
  const { rows } = await pool().query(
    `select s.*, ${SHIPMENT_TOTALS_SQL}
       from stock_shipments s
       left join stock_shipment_items i on i.shipment_id = s.id
      group by s.id
      order by s.created_at desc`
  );
  return rows.map(summaryFromRow);
}

export async function getShipment(id: string): Promise<Shipment | null> {
  const { rows } = await pool().query(
    `select s.*, ${SHIPMENT_TOTALS_SQL}
       from stock_shipments s
       left join stock_shipment_items i on i.shipment_id = s.id
      where s.id = $1
      group by s.id`,
    [id]
  );
  if (!rows[0]) return null;
  const [{ rows: itemRows }, files] = await Promise.all([
    pool().query(
      `select i.*, p.name as product_name, p.sku, p.price, p.currency
         from stock_shipment_items i join products p on p.id = i.product_id
        where i.shipment_id = $1
        order by p.name asc`,
      [id]
    ),
    listShipmentFiles(id),
  ]);
  return {
    ...summaryFromRow(rows[0]),
    files,
    items: itemRows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      qtyExpected: Number(r.qty_expected),
      qtyReceived: Number(r.qty_received),
      qtyFaulty: Number(r.qty_faulty),
      qtyGood: Number(r.qty_good),
      qtyShort: Number(r.qty_short),
      note: r.note,
      unitPrice: Number(r.price),
      currency: r.currency,
      // Valued on the units that actually become sellable stock, not on what
      // the supplier billed -- faulty units are worth nothing to the shop.
      lineValue: Number(r.price) * Number(r.qty_good),
    })),
  };
}

/**
 * Merges imported lines into a draft shipment, keyed by product. An existing
 * line for the same product is overwritten rather than added to, so
 * re-uploading a corrected sheet converges on the corrected numbers instead
 * of doubling them.
 */
export async function mergeShipmentLines(
  shipmentId: string,
  lines: { productId: string; qtyExpected: number; qtyReceived: number; qtyFaulty: number; note: string }[]
): Promise<{ ok: true; added: number; updated: number } | { ok: false; error: string }> {
  if (lines.length === 0) return { ok: true, added: 0, updated: 0 };

  const db = pool();
  const { rows } = await db.query<{ status: string }>(`select status from stock_shipments where id = $1`, [shipmentId]);
  if (!rows[0]) return { ok: false, error: "That shipment no longer exists." };
  if (rows[0].status === "received") {
    return { ok: false, error: "This shipment has already been received, so its lines can't change." };
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    let added = 0;
    let updated = 0;
    for (const l of lines) {
      const { rowCount } = await client.query(
        `update stock_shipment_items
            set qty_expected = $3, qty_received = $4, qty_faulty = $5,
                note = case when $6 <> '' then $6 else note end
          where shipment_id = $1 and product_id = $2`,
        [shipmentId, l.productId, l.qtyExpected, l.qtyReceived, l.qtyFaulty, l.note]
      );
      if (rowCount && rowCount > 0) {
        updated++;
      } else {
        await client.query(
          `insert into stock_shipment_items (shipment_id, product_id, qty_expected, qty_received, qty_faulty, note)
           values ($1, $2, $3, $4, $5, $6)`,
          [shipmentId, l.productId, l.qtyExpected, l.qtyReceived, l.qtyFaulty, l.note]
        );
        added++;
      }
    }
    await client.query(`update stock_shipments set updated_at = now() where id = $1`, [shipmentId]);
    await client.query("commit");
    return { ok: true, added, updated };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function createShipment(input: {
  reference: string;
  supplier: string;
  shippedDate: string | null;
  notes: string;
  createdBy: string | null;
}): Promise<string> {
  const { rows } = await pool().query<{ id: string }>(
    `insert into stock_shipments (reference, supplier, shipped_date, notes, created_by)
     values ($1, $2, $3, $4, $5) returning id`,
    [input.reference, input.supplier, input.shippedDate, input.notes, input.createdBy]
  );
  return rows[0].id;
}

/** Replaces the whole line set for a draft shipment. Rejected once received, so posted quantities can never be edited out from under the ledger. */
export async function saveShipmentLines(
  shipmentId: string,
  lines: { productId: string; qtyExpected: number; qtyReceived: number; qtyFaulty: number; note: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = pool();
  const { rows } = await db.query<{ status: string }>(`select status from stock_shipments where id = $1`, [shipmentId]);
  if (!rows[0]) return { ok: false, error: "That shipment no longer exists." };
  if (rows[0].status === "received") return { ok: false, error: "This shipment has already been received and can't be edited." };

  for (const l of lines) {
    if (l.qtyFaulty > l.qtyReceived) {
      return { ok: false, error: "Faulty units can't exceed the number received on a line." };
    }
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(`delete from stock_shipment_items where shipment_id = $1`, [shipmentId]);
    for (const l of lines) {
      await client.query(
        `insert into stock_shipment_items (shipment_id, product_id, qty_expected, qty_received, qty_faulty, note)
         values ($1, $2, $3, $4, $5, $6)`,
        [shipmentId, l.productId, l.qtyExpected, l.qtyReceived, l.qtyFaulty, l.note]
      );
    }
    await client.query(`update stock_shipments set updated_at = now() where id = $1`, [shipmentId]);
    await client.query("commit");
    return { ok: true };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Posts a draft shipment to stock: one 'shipment_received' movement per line
 * for its GOOD units only, then flips the shipment to received.
 *
 * The status flip happens in the same transaction as the movements and is
 * guarded by `status = 'draft'` in its WHERE clause, so two admins hitting
 * Receive at the same moment can't both post -- the second finds zero rows
 * updated and the whole transaction rolls back rather than double-crediting
 * stock.
 */
export async function receiveShipment(
  shipmentId: string,
  receivedBy: string | null
): Promise<{ ok: true; unitsAdded: number; faulty: number } | { ok: false; error: string }> {
  const db = pool();
  const client = await db.connect();
  try {
    await client.query("begin");

    const { rows: shipRows } = await client.query<{ status: string; reference: string }>(
      `select status, reference from stock_shipments where id = $1 for update`,
      [shipmentId]
    );
    if (!shipRows[0]) {
      await client.query("rollback");
      return { ok: false, error: "That shipment no longer exists." };
    }
    if (shipRows[0].status === "received") {
      await client.query("rollback");
      return { ok: false, error: "This shipment has already been received." };
    }

    const { rows: items } = await client.query<{ product_id: string; qty_good: number; qty_faulty: number }>(
      `select product_id, qty_good, qty_faulty from stock_shipment_items where shipment_id = $1`,
      [shipmentId]
    );
    if (items.length === 0) {
      await client.query("rollback");
      return { ok: false, error: "Add at least one product line before receiving this shipment." };
    }

    let unitsAdded = 0;
    let faulty = 0;
    for (const item of items) {
      const good = Number(item.qty_good);
      faulty += Number(item.qty_faulty);
      if (good > 0) {
        await recordMovement(client, {
          productId: item.product_id,
          delta: good,
          reason: "shipment_received",
          sourceType: "shipment",
          sourceId: shipmentId,
          note: shipRows[0].reference,
          createdBy: receivedBy,
        });
        unitsAdded += good;
      }
    }

    const { rowCount } = await client.query(
      `update stock_shipments
          set status = 'received', received_date = coalesce(received_date, current_date), updated_at = now()
        where id = $1 and status = 'draft'`,
      [shipmentId]
    );
    if (rowCount === 0) {
      await client.query("rollback");
      return { ok: false, error: "This shipment has already been received." };
    }

    await client.query("commit");
    return { ok: true, unitsAdded, faulty };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/* --------------------------- shipment attachments ------------------------- */

export async function listShipmentFiles(shipmentId: string): Promise<ShipmentFile[]> {
  const { rows } = await pool().query(
    `select * from stock_shipment_files where shipment_id = $1 order by created_at desc`,
    [shipmentId]
  );
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    storagePath: r.storage_path,
    contentType: r.content_type,
    sizeBytes: Number(r.size_bytes),
    uploadedBy: r.uploaded_by,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function addShipmentFile(input: {
  shipmentId: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
}): Promise<void> {
  await pool().query(
    `insert into stock_shipment_files (shipment_id, file_name, storage_path, content_type, size_bytes, uploaded_by)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.shipmentId, input.fileName, input.storagePath, input.contentType, input.sizeBytes, input.uploadedBy]
  );
}

/** Returns the storage path so the caller can remove the object too -- the row and the blob are deleted together, never just one. */
export async function deleteShipmentFile(fileId: string): Promise<{ storagePath: string; shipmentId: string } | null> {
  const { rows } = await pool().query<{ storage_path: string; shipment_id: string }>(
    `delete from stock_shipment_files where id = $1 returning storage_path, shipment_id`,
    [fileId]
  );
  return rows[0] ? { storagePath: rows[0].storage_path, shipmentId: rows[0].shipment_id } : null;
}

export async function deleteDraftShipment(id: string): Promise<void> {
  // Only drafts -- a received shipment has ledger rows pointing at it.
  await pool().query(`delete from stock_shipments where id = $1 and status = 'draft'`, [id]);
}

/** Total faulty units per product across every shipment, worst first. Answers "what keeps arriving broken". */
export async function getFaultySummary(): Promise<
  { productId: string; productName: string; sku: string; faulty: number; received: number; faultyRate: number }[]
> {
  const { rows } = await pool().query(
    `select i.product_id, p.name as product_name, p.sku,
            sum(i.qty_faulty) as faulty, sum(i.qty_received) as received
       from stock_shipment_items i
       join products p on p.id = i.product_id
       join stock_shipments s on s.id = i.shipment_id
      where s.status = 'received'
      group by i.product_id, p.name, p.sku
     having sum(i.qty_faulty) > 0
      order by sum(i.qty_faulty) desc`
  );
  return rows.map((r) => {
    const faulty = Number(r.faulty);
    const received = Number(r.received);
    return {
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      faulty,
      received,
      faultyRate: received > 0 ? (faulty / received) * 100 : 0,
    };
  });
}

/* -------------------------------- counts --------------------------------- */

export type StockCountItem = {
  productId: string;
  productName: string;
  sku: string;
  systemQty: number;
  countedQty: number;
  variance: number;
};

export type StockCount = {
  id: string;
  countedOn: string;
  status: "draft" | "applied";
  notes: string;
  createdBy: string | null;
  createdAt: string;
  appliedAt: string | null;
  items: StockCountItem[];
  linesCounted: number;
  netVariance: number;
  absVariance: number;
};

export async function listStockCounts(limit = 20): Promise<Omit<StockCount, "items">[]> {
  const { rows } = await pool().query(
    `select c.*,
            count(i.id) as lines_counted,
            coalesce(sum(i.variance), 0) as net_variance,
            coalesce(sum(abs(i.variance)), 0) as abs_variance
       from stock_counts c
       left join stock_count_items i on i.count_id = c.id
      group by c.id
      order by c.created_at desc
      limit $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    countedOn: r.counted_on,
    status: r.status,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
    appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
    linesCounted: Number(r.lines_counted),
    netVariance: Number(r.net_variance),
    absVariance: Number(r.abs_variance),
  }));
}

/**
 * Records a physical count and reconciles stock to it in one transaction:
 * every line whose counted quantity differs from what the system believed
 * gets a 'count_adjustment' movement for exactly the variance, which is what
 * moves stock_on_hand onto the counted figure.
 *
 * system_qty is re-read here under the transaction rather than trusted from
 * the form, so the variance recorded is against what stock actually was at
 * the moment of reconciliation -- if a sale landed while the shelf was being
 * counted, that shows up as a variance instead of being silently overwritten.
 */
export async function applyStockCount(input: {
  countedOn: string;
  notes: string;
  createdBy: string | null;
  lines: { productId: string; countedQty: number }[];
}): Promise<{ ok: true; countId: string; adjusted: number; netVariance: number } | { ok: false; error: string }> {
  if (input.lines.length === 0) return { ok: false, error: "Enter a counted quantity for at least one product." };

  const db = pool();
  const client = await db.connect();
  try {
    await client.query("begin");

    const { rows: countRows } = await client.query<{ id: string }>(
      `insert into stock_counts (counted_on, notes, created_by, status, applied_at)
       values ($1, $2, $3, 'applied', now()) returning id`,
      [input.countedOn, input.notes, input.createdBy]
    );
    const countId = countRows[0].id;

    let adjusted = 0;
    let netVariance = 0;
    for (const line of input.lines) {
      const { rows: prodRows } = await client.query<{ stock_on_hand: number }>(
        `select stock_on_hand from products where id = $1 for update`,
        [line.productId]
      );
      if (!prodRows[0]) continue;
      const systemQty = Number(prodRows[0].stock_on_hand);
      const variance = line.countedQty - systemQty;

      await client.query(
        `insert into stock_count_items (count_id, product_id, system_qty, counted_qty)
         values ($1, $2, $3, $4)`,
        [countId, line.productId, systemQty, line.countedQty]
      );

      if (variance !== 0) {
        await recordMovement(client, {
          productId: line.productId,
          delta: variance,
          reason: "count_adjustment",
          sourceType: "count",
          sourceId: countId,
          note: `Counted ${line.countedQty}, system had ${systemQty}`,
          createdBy: input.createdBy,
        });
        adjusted++;
        netVariance += variance;
      }
    }

    await client.query("commit");
    return { ok: true, countId, adjusted, netVariance };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Everything the count sheet needs: every product with what the system currently believes it holds. */
export type CountSheetRow = { productId: string; name: string; sku: string; category: string; systemQty: number };

export async function getCountSheet(): Promise<CountSheetRow[]> {
  const { rows } = await pool().query(
    `select id, name, sku, category, stock_on_hand from products order by category asc, name asc`
  );
  return rows.map((r) => ({
    productId: r.id,
    name: r.name,
    sku: r.sku,
    category: r.category,
    systemQty: Number(r.stock_on_hand),
  }));
}
