import fs from "fs";
import path from "path";
import sharp from "sharp";
import { pool } from "@/lib/db";

/**
 * Crops the dead transparent margin off cutout product photos so the product
 * fills its card instead of floating in the middle of it.
 *
 * Supplier cutouts arrive on whatever canvas the photographer used -- often
 * 2000x1125 with the bottle occupying a third of it. The card scales the whole
 * canvas to fit, empty space included, so the product renders small no matter
 * how large the file is. Cropping to what is actually there fixes it at the
 * source, with no per-image CSS.
 *
 * Two rules keep this safe:
 *
 *  - Only cutouts are touched. sharp's trim() crops by matching the border
 *    colour, so on a photograph with a real background it would happily eat
 *    into the picture. Anything without meaningful transparency is skipped.
 *
 *  - A margin is added back. Trimming to the exact bounding box would leave a
 *    rectangular product (a boxed set, a sachet) fully opaque, and
 *    detect-image-backgrounds measures mean alpha -- it would then read as a
 *    photograph and get the blurred edge-to-edge treatment meant for lifestyle
 *    shots. The margin keeps the corners transparent, and looks better than a
 *    product touching the frame anyway.
 *
 *   npx tsx --env-file=.env.production.local scripts/trim-product-images.ts
 *   npx tsx --env-file=.env.production.local scripts/trim-product-images.ts --apply
 */

/** Per side, as a fraction of the trimmed product's longest edge. */
const MARGIN = 0.04;

/** Mean alpha at or above this means no meaningful transparency -- a
 * photograph, not a cutout. Matches detect-image-backgrounds.ts. */
const OPAQUE_MEAN_ALPHA = 250;

/**
 * Not worth rewriting a file to reclaim a sliver.
 *
 * Must sit ABOVE the margin this script itself adds, or re-running it is not
 * a no-op: it strips its own 4% margin, sees that as a ~9% gain, and writes
 * the same picture back with fresh bytes. A second run rewrote 40 files that
 * way and produced a diff with no visible change in it.
 */
const MIN_GAIN = (1 / (1 - 2 * 0.04) - 1) + 0.02; // margin round-trip, plus headroom

const APPLY = process.argv.includes("--apply");

async function main() {
  const { rows } = await pool().query<{ id: string; name: string; images: string[] }>(
    "select id, name, images from products order by id"
  );

  let trimmed = 0, skippedPhoto = 0, skippedTight = 0;

  for (const p of rows) {
    const src = (p.images ?? [])[0];
    if (!src?.startsWith("/")) continue;
    const file = path.join("public", src.replace(/^\//, ""));
    if (!fs.existsSync(file)) continue;

    // Read into memory first. sharp holds the source path open while it
    // works, and on Windows writing back to that same path then fails with an
    // opaque EUNKNOWN -- which is exactly how this script died halfway
    // through its first run.
    const bytes = fs.readFileSync(file);

    const meta = await sharp(bytes).metadata();
    if (!meta.hasAlpha) { skippedPhoto++; continue; }
    const stats = await sharp(bytes).stats();
    if (stats.channels[stats.channels.length - 1].mean >= OPAQUE_MEAN_ALPHA) { skippedPhoto++; continue; }

    const W = meta.width ?? 0, H = meta.height ?? 0;
    const cut = await sharp(bytes).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = cut.info;
    if (!w || !h) continue;

    // How much bigger the product renders once the empty space is gone. Both
    // fits are "longest side wins", so the ratio of the binding dimensions is
    // the scale-up the card will apply.
    const gain = Math.max(W, H) / Math.max(w, h) - 1;
    if (gain < MIN_GAIN) { skippedTight++; continue; }

    const pad = Math.round(Math.max(w, h) * MARGIN);
    console.log(
      `  ${p.id.padEnd(9)} ${String(W + "x" + H).padEnd(12)} -> ${String(w + pad * 2) + "x" + String(h + pad * 2)}` +
        `   +${(gain * 100).toFixed(0)}% larger on the card   ${p.name.slice(0, 38)}`
    );

    if (APPLY) {
      const padded = sharp(cut.data).extend({
        top: pad, bottom: pad, left: pad, right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
      // Re-encoded explicitly rather than at sharp's defaults: a plain
      // round-trip wrote these back LARGER than the originals despite holding
      // fewer pixels, which would have grown the repo while fixing the
      // framing. compressionLevel 9 is lossless -- only the encoder works
      // harder.
      const out = path.extname(file).slice(1) === "webp"
        ? await padded.webp({ quality: 82, effort: 6 }).toBuffer()
        : await padded.png({ compressionLevel: 9, effort: 10 }).toBuffer();

      // Never write back something bigger than what was there.
      if (out.length < bytes.length) {
        fs.writeFileSync(file, out);
      } else {
        console.log(`      (kept original — re-encode was larger)`);
      }
    }
    trimmed++;
  }

  console.log(`\n${trimmed} image(s) ${APPLY ? "trimmed" : "would be trimmed"}`);
  console.log(`skipped: ${skippedPhoto} photograph(s) with a real background, ${skippedTight} already tight`);
  if (!APPLY) console.log("Dry run. Re-run with --apply.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
