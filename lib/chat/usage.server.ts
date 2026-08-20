import { pool } from "@/lib/db";

/**
 * The spend ceiling for the customer assistant.
 *
 * Two limits, doing different jobs:
 *
 *   PER VISITOR  stops one person monopolising the assistant. Keyed on session
 *                id where there is one and IP otherwise, so it is defeated by
 *                anyone willing to rotate IPs. That is fine; it is not the
 *                thing protecting the bill.
 *
 *   GLOBAL       is the thing protecting the bill. One counter for the whole
 *                shop, per day, that no amount of IP rotation, cold starting,
 *                or concurrency can get around. When it is spent the assistant
 *                politely stops until tomorrow.
 *
 * The global cap is deliberately set near what a busy real day looks like
 * rather than at some comfortable multiple of it. Hitting it means either the
 * shop has become far more popular overnight, or someone is abusing the
 * endpoint; both are worth finding out about from a quiet assistant rather
 * than from an invoice.
 */

/** Requests per day across the entire shop. */
export const GLOBAL_DAILY_REQUESTS = Number(process.env.CHAT_DAILY_LIMIT ?? 500);

/** Requests per day per visitor. */
export const VISITOR_DAILY_REQUESTS = Number(process.env.CHAT_VISITOR_DAILY_LIMIT ?? 40);

export type ClaimResult =
  | { ok: true }
  | { ok: false; scope: "global" | "visitor" };

/**
 * Take one request from both allowances.
 *
 * The global claim happens first. If the shop's day is spent there is no
 * reason to charge the visitor's allowance for a request that will not run.
 *
 * A database that is down or has never had this schema applied returns ok:
 * the assistant degrades to the in-memory limiter rather than going dark
 * because of an accounting table. That is a deliberate trade -- the caps in
 * app/api/chat/route.ts (tool rounds, output tokens, message size) still bound
 * what any single request can cost even with this file unavailable.
 */
export async function claimChatRequest(visitorBucket: string): Promise<ClaimResult> {
  try {
    const db = pool();

    const global = await db.query<{ chat_usage_claim: boolean }>(
      "select chat_usage_claim($1, $2)",
      ["global", GLOBAL_DAILY_REQUESTS]
    );
    if (!global.rows[0]?.chat_usage_claim) return { ok: false, scope: "global" };

    const visitor = await db.query<{ chat_usage_claim: boolean }>(
      "select chat_usage_claim($1, $2)",
      [visitorBucket, VISITOR_DAILY_REQUESTS]
    );
    if (!visitor.rows[0]?.chat_usage_claim) return { ok: false, scope: "visitor" };

    return { ok: true };
  } catch (err) {
    console.error("[chat] usage accounting unavailable, falling through:", err);
    return { ok: true };
  }
}

/**
 * Record what the finished request actually cost, against both buckets.
 *
 * Never throws and is never awaited by the response path: an answer already
 * streamed to a customer must not fail because a counter could not be written.
 * The consequence is that a crash between answering and recording loses that
 * request's token count, which is acceptable for a figure whose purpose is
 * sizing the cap rather than billing anyone.
 */
export function recordChatUsage(
  visitorBucket: string,
  usage: { input: number; output: number }
): void {
  const write = async () => {
    const db = pool();
    await Promise.all([
      db.query("select chat_usage_record($1, $2, $3)", ["global", usage.input, usage.output]),
      db.query("select chat_usage_record($1, $2, $3)", [visitorBucket, usage.input, usage.output]),
    ]);
  };
  void write().catch((err) => console.error("[chat] could not record usage:", err));
}

/** Today's totals, for whoever wants to know what the assistant is costing. */
export async function getTodayChatUsage(): Promise<{
  requests: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const { rows } = await pool().query<{
    requests: string;
    input_tokens: string;
    output_tokens: string;
  }>(
    "select requests, input_tokens, output_tokens from chat_usage where day = current_date and bucket = 'global'"
  );
  const r = rows[0];
  return {
    requests: Number(r?.requests ?? 0),
    inputTokens: Number(r?.input_tokens ?? 0),
    outputTokens: Number(r?.output_tokens ?? 0),
  };
}
