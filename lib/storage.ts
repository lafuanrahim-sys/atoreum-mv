import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Storage — replaces writing uploaded files to the local
 * filesystem (public/uploads/payment-proofs, public/images/products), which
 * doesn't persist on Vercel's read-only/ephemeral serverless filesystem.
 * Pre-existing, build-time seed product photography under public/images/
 * is unaffected — it ships as part of the deployed bundle and is only ever
 * read, never written at runtime, so it stays exactly where it is. Only
 * NEW uploads (checkout receipts, admin-added product images) move here.
 *
 * Uses the service role key, which bypasses Row Level Security — required
 * since these uploads happen from server actions with no end-user Supabase
 * session. Never import this from a "use client" file.
 */

export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const PRODUCT_IMAGES_BUCKET = "product-images";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example for setup.`);
  }
  return value;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  client = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  return client;
}

/** Uploads a file to a public bucket and returns its public URL. Bucket must already exist (created once via the Supabase dashboard or API — see docs). */
export async function uploadPublicFile(params: {
  bucket: string;
  path: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const { error } = await getClient()
    .storage.from(params.bucket)
    .upload(params.path, params.bytes, { contentType: params.contentType, upsert: false });
  if (error) {
    throw new Error(`Upload to ${params.bucket}/${params.path} failed: ${error.message}`);
  }
  const { data } = getClient().storage.from(params.bucket).getPublicUrl(params.path);
  return data.publicUrl;
}
