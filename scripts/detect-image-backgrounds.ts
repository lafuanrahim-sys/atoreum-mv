import fs from "fs";
import path from "path";
import sharp from "sharp";
import { pool } from "@/lib/db";

/**
 * Works out which products have a photo with its own background, and records
 * it on the row (products.image_has_background).
 *
 * Why it matters: the product card centres a cutout with room around it, but
 * a lifestyle shot -- the bottle on a styled surface -- has its own edges, so
 * centring it leaves flat bars above and below inside the 4:5 tile. Those get
 * filled edge-to-edge instead.
 *
 * The measure is MEAN alpha, not minimum. A cutout is mostly transparent and
 * averages around 35; a photograph averages exactly 255. Minimum alpha looks
 * like the obvious test and is wrong -- a photo carrying one soft anti-aliased
 * edge dips to 0 somewhere and gets misread as a cutout, which is exactly how
 * amp-006 ended up needing to be listed by hand.
 *
 * Re-run after adding or replacing product photos:
 *   npx tsx --env-file=.env.local scripts/detect-image-backgrounds.ts
 *   npx tsx --env-file=.env.production.local scripts/detect-image-backgrounds.ts --apply
 */

/** Above this, treat the image as a photograph with a background. The two
 * populations sit at ~35 and 255, so the exact value is not delicate. */
const OPAQUE_MEAN_ALPHA = 250;

const APPLY = process.argv.includes("--apply");

async function meanAlpha(file: string): Promise<number> {
  const img = sharp(file);
  if (!(await img.metadata()).hasAlpha) return 255;
  const stats = await img.stats();
  return stats.channels[stats.channels.length - 1].mean;
}

async function main() {
  const { rows } = await pool().query<{ id: string; name: string; images: string[]; image_has_background: boolean }>(
    "select id, name, images, image_has_background from products order by id"
  );

  let changed = 0;
  const skipped: string[] = [];

  for (const p of rows) {
    const src = (p.images ?? [])[0];
    // Remote images (Supabase-hosted admin uploads) aren't on disk to measure.
    // Left at whatever they already are rather than guessed at.
    if (!src || !src.startsWith("/")) {
      skipped.push(p.id);
      continue;
    }
    const file = path.join("public", src.replace(/^\//, ""));
    if (!fs.existsSync(file)) {
      skipped.push(p.id);
      continue;
    }

    const mean = await meanAlpha(file);
    const hasBackground = mean >= OPAQUE_MEAN_ALPHA;
    if (hasBackground === p.image_has_background) continue;

    changed++;
    console.log(
      `  ${p.id.padEnd(9)} ${String(p.image_has_background).padEnd(5)} -> ${String(hasBackground).padEnd(5)}` +
        `  (mean alpha ${mean.toFixed(1)})  ${p.name}`
    );
    if (APPLY) {
      await pool().query("update products set image_has_background = $2, updated_at = now() where id = $1", [
        p.id,
        hasBackground,
      ]);
    }
  }

  console.log(`\n${changed} product(s) ${APPLY ? "updated" : "would change"}`);
  if (skipped.length) console.log(`skipped (no local image file): ${skipped.join(", ")}`);
  if (!APPLY) console.log("Dry run. Re-run with --apply.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
