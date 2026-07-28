import crypto from "crypto";
import { pool } from "@/lib/db";

/**
 * Postgres-backed review store (see lib/data/schema.sql) — replaces the
 * original JSON-on-disk version, which didn't persist on Vercel's
 * read-only/ephemeral serverless filesystem. Same exported functions as
 * before (now async).
 *
 * Product reviews — written by signed-in customers on the product page,
 * moderated (approve/delete) from Dashboard → Reviews. Only approved
 * reviews are shown on the storefront.
 */

export type ReviewStatus = "pending" | "approved";

export type Review = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1–5
  text: string;
  status: ReviewStatus;
  createdAt: string;
};

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  created_at: string;
};

function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    text: row.text,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listAllReviews(): Promise<Review[]> {
  const { rows } = await pool().query<ReviewRow>("select * from reviews order by created_at desc");
  return rows.map(rowToReview);
}

export async function listApprovedReviews(productId: string): Promise<Review[]> {
  const { rows } = await pool().query<ReviewRow>(
    "select * from reviews where product_id = $1 and status = 'approved' order by created_at desc",
    [productId]
  );
  return rows.map(rowToReview);
}

/** Average rating + count per product, from approved reviews only — powers the star rating shown on product cards. */
export async function getRatingSummaries(): Promise<Record<string, { average: number; count: number }>> {
  const { rows } = await pool().query<{ product_id: string; average: string; count: string }>(
    `select product_id, avg(rating)::text as average, count(*)::text as count
     from reviews where status = 'approved'
     group by product_id`
  );
  const summaries: Record<string, { average: number; count: number }> = {};
  for (const row of rows) {
    summaries[row.product_id] = { average: Number(row.average), count: Number(row.count) };
  }
  return summaries;
}

export async function getRatingSummary(productId: string): Promise<{ average: number; count: number } | null> {
  const summaries = await getRatingSummaries();
  return summaries[productId] ?? null;
}

export async function createReview(params: {
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
}): Promise<Review> {
  const id = `rev-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const rating = Math.min(5, Math.max(1, Math.round(params.rating)));
  const { rows } = await pool().query<ReviewRow>(
    `insert into reviews (id, product_id, user_id, user_name, rating, text, status)
     values ($1, $2, $3, $4, $5, $6, 'pending')
     returning *`,
    [id, params.productId, params.userId, params.userName, rating, params.text.trim()]
  );
  return rowToReview(rows[0]);
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<Review | null> {
  const { rows } = await pool().query<ReviewRow>(
    "update reviews set status = $2 where id = $1 returning *",
    [id, status]
  );
  return rows[0] ? rowToReview(rows[0]) : null;
}

export async function deleteReview(id: string): Promise<boolean> {
  const { rowCount } = await pool().query("delete from reviews where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
