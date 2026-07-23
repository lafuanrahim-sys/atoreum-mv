import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Product reviews — written by signed-in customers on the product page,
 * moderated (approve/delete) from Dashboard → Reviews. Only approved
 * reviews are shown on the storefront.
 *
 * Same Supabase-swappable pattern as the other stores: JSON-on-disk,
 * server-only, auto-created, all access through the exported functions so
 * a later migration touches only this file.
 */

const DATA_PATH = path.join(process.cwd(), "data", "reviews.json");

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

function readAll(): Review[] {
  if (!fs.existsSync(DATA_PATH)) {
    writeAll([]);
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as Review[];
}

function writeAll(reviews: Review[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(reviews, null, 2) + "\n", "utf-8");
}

export function listAllReviews(): Review[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listApprovedReviews(productId: string): Review[] {
  return readAll()
    .filter((r) => r.productId === productId && r.status === "approved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createReview(params: {
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
}): Review {
  const all = readAll();
  const review: Review = {
    id: `rev-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    productId: params.productId,
    userId: params.userId,
    userName: params.userName,
    rating: Math.min(5, Math.max(1, Math.round(params.rating))),
    text: params.text.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  all.push(review);
  writeAll(all);
  return review;
}

export function setReviewStatus(id: string, status: ReviewStatus): Review | null {
  const all = readAll();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) return null;
  all[index] = { ...all[index], status };
  writeAll(all);
  return all[index];
}

export function deleteReview(id: string): boolean {
  const all = readAll();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}
