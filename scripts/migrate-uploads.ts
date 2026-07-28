import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * One-time migration: uploads every file under public/uploads/
 * payment-proofs/ to the Supabase Storage `payment-proofs` bucket, and
 * repoints the matching order's payment_proof_path (matched by filename)
 * at the new public URL, in whichever database DATABASE_URL points at.
 *
 * public/images/products/ is deliberately NOT touched here — that's
 * build-time seed photography that ships in the deployed bundle and stays
 * exactly where it is (see lib/storage.ts's top comment).
 *
 * Run once per target database:
 *   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-uploads.ts
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "payment-proofs");
const BUCKET = "payment-proofs";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log("No public/uploads/payment-proofs directory — nothing to migrate.");
    await pool.end();
    return;
  }

  const files = fs.readdirSync(UPLOAD_DIR);
  console.log(`Found ${files.length} file(s) in public/uploads/payment-proofs/`);

  for (const filename of files) {
    const oldPath = `/uploads/payment-proofs/${filename}`;
    const bytes = fs.readFileSync(path.join(UPLOAD_DIR, filename));
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filename, bytes, {
      contentType,
      upsert: true, // idempotent re-run
    });
    if (uploadError) {
      console.error(`  ${filename}: upload FAILED — ${uploadError.message}`);
      continue;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    const { rowCount } = await pool.query(
      "update orders set payment_proof_path = $1, updated_at = now() where payment_proof_path = $2",
      [data.publicUrl, oldPath]
    );
    console.log(`  ${filename}: uploaded, ${rowCount} order row(s) repointed -> ${data.publicUrl}`);
  }

  await pool.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
