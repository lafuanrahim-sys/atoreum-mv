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

/**
 * Shipment paperwork (supplier invoices, packing lists, photos of damaged
 * goods). Deliberately a PRIVATE bucket, unlike the two above: an invoice
 * carries supplier pricing and terms, and a public bucket serves anything
 * to anyone holding the URL. Nothing here is ever linked with a permanent
 * public URL -- reads go through createSignedDownloadUrl() below, which
 * mints a link that expires.
 */
export const SHIPMENT_FILES_BUCKET = "shipment-files";

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

/**
 * Uploads to a private bucket. Returns only the storage path, never a URL --
 * there is no public URL for these, by design. Pair with
 * createSignedDownloadUrl() at read time.
 */
export async function uploadPrivateFile(params: {
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
  return params.path;
}

/**
 * A time-limited download link for a private object. Generated per page
 * render rather than stored, so a link that leaks (browser history, a
 * forwarded screenshot) stops working shortly after.
 */
export async function createSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const { data, error } = await getClient().storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await getClient().storage.from(bucket).remove([path]);
  // A missing object is not an error worth failing the caller for -- the
  // desired end state (no such file) already holds.
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Delete of ${bucket}/${path} failed: ${error.message}`);
  }
}

/** Creates the bucket if it isn't there yet. Safe to call repeatedly; used by scripts/ensure-buckets.ts. */
export async function ensureBucket(bucket: string, isPublic: boolean): Promise<"created" | "exists"> {
  const { data } = await getClient().storage.getBucket(bucket);
  if (data) return "exists";
  const { error } = await getClient().storage.createBucket(bucket, { public: isPublic });
  if (error) throw new Error(`Creating bucket ${bucket} failed: ${error.message}`);
  return "created";
}
