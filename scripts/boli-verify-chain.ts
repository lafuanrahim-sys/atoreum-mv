import "./boli-env";
import crypto from "crypto";
import { pool } from "../lib/boli/db";

const GENESIS = "genesis";

/**
 * Walks every user's boli_ledger chain in sequence order and recomputes
 * each entry_hash from (user_id, sequence, delta, reason, source_type,
 * source_id, prev_hash) — the exact canonical form lib/boli/schema.sql's
 * boli_ledger_write() hashes (see that file for why created_at is
 * deliberately excluded). Reports any row whose stored hash doesn't match,
 * any prev_hash that doesn't chain to the prior row's entry_hash, and any
 * gap in the sequence. Run with `npm run boli:verify-chain`.
 */
function computeHash(params: {
  userId: string;
  sequence: string;
  delta: string;
  reason: string;
  sourceType: string;
  sourceId: string | null;
  prevHash: string;
}): string {
  const canonical = [
    params.userId,
    params.sequence,
    params.delta,
    params.reason,
    params.sourceType,
    params.sourceId ?? "",
    params.prevHash,
  ].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

async function main() {
  const db = pool();

  const { rows: userRows } = await db.query<{ user_id: string }>(`select user_id from boli_users`);

  let brokenChains = 0;
  let totalRows = 0;

  for (const u of userRows) {
    const { rows } = await db.query<{
      sequence: string;
      delta: string;
      reason: string;
      source_type: string;
      source_id: string | null;
      prev_hash: string;
      entry_hash: string;
    }>(
      `select sequence, delta, reason, source_type, source_id, prev_hash, entry_hash
       from boli_ledger where user_id = $1 order by sequence asc`,
      [u.user_id]
    );

    let expectedPrevHash = GENESIS;
    let expectedSequence = 1;

    for (const row of rows) {
      totalRows++;
      const seq = Number(row.sequence);

      if (seq !== expectedSequence) {
        brokenChains++;
        console.error(`SEQUENCE GAP user=${u.user_id} expected=${expectedSequence} found=${seq}`);
      }

      if (row.prev_hash !== expectedPrevHash) {
        brokenChains++;
        console.error(`CHAIN BREAK user=${u.user_id} sequence=${seq} expected prev_hash=${expectedPrevHash} found=${row.prev_hash}`);
      }

      const recomputed = computeHash({
        userId: u.user_id,
        sequence: row.sequence,
        delta: row.delta,
        reason: row.reason,
        sourceType: row.source_type,
        sourceId: row.source_id,
        prevHash: row.prev_hash,
      });

      if (recomputed !== row.entry_hash) {
        brokenChains++;
        console.error(`HASH MISMATCH user=${u.user_id} sequence=${seq} expected=${recomputed} stored=${row.entry_hash}`);
      }

      expectedPrevHash = row.entry_hash;
      expectedSequence = seq + 1;
    }
  }

  console.log(`Checked ${totalRows} ledger row(s) across ${userRows.length} user(s), ${brokenChains} issue(s).`);
  if (brokenChains > 0) process.exitCode = 1;
  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await pool().end();
});
