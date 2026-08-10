import { ensureBucket, PAYMENT_PROOFS_BUCKET, PRODUCT_IMAGES_BUCKET, SHIPMENT_FILES_BUCKET } from "@/lib/storage";

/**
 * Creates any Supabase Storage bucket the app expects but doesn't have yet.
 * Idempotent -- an existing bucket is left exactly as it is, including its
 * public/private setting, so re-running can never flip an existing bucket's
 * visibility.
 *
 *   npx tsx --env-file=.env.local scripts/ensure-buckets.ts
 */
const BUCKETS: { name: string; public: boolean }[] = [
  { name: PAYMENT_PROOFS_BUCKET, public: true },
  { name: PRODUCT_IMAGES_BUCKET, public: true },
  // Private: supplier invoices carry pricing, and reads go through
  // short-lived signed URLs instead (see lib/storage.ts).
  { name: SHIPMENT_FILES_BUCKET, public: false },
];

async function main() {
  for (const b of BUCKETS) {
    const result = await ensureBucket(b.name, b.public);
    console.log(`${b.name.padEnd(18)} ${result}${result === "created" ? ` (public: ${b.public})` : ""}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
