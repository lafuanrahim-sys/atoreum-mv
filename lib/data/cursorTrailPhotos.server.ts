import fs from "node:fs";
import path from "node:path";

/**
 * The photographs behind the cursor trail on the About page.
 *
 * One named folder, chosen deliberately: public/images/Cursor Move Image.
 * Everything in it is used, and a file dropped in later appears on its own,
 * so the set is curated by moving files rather than by editing this.
 */

const FOLDER = "Cursor Move Image";
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;

/**
 * Largest step under half the count that shares no factor with it.
 *
 * Read in name order the trail would show every "Truly ..." serum in a row,
 * then every "Dr ...", because the folder is alphabetical and so are the
 * product ranges. Walking the list in strides instead puts consecutive
 * spawns far apart in the alphabet. A stride coprime with the length is
 * guaranteed to visit every photograph exactly once before repeating, so
 * spreading them costs nothing in coverage.
 */
function spreadStride(count: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  for (let step = Math.floor(count / 2); step > 1; step--) {
    if (gcd(step, count) === 1) return step;
  }
  return 1;
}

export function listCursorTrailPhotos(): string[] {
  const dir = path.join(process.cwd(), "public", "images", FOLDER);

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((file) => IMAGE_EXTENSION.test(file)).sort();
  } catch (err) {
    // The component keeps its own small fallback list, so a missing folder
    // costs the variety and nothing else.
    console.error(`[cursorTrailPhotos] could not read ${FOLDER}:`, err);
    return [];
  }
  if (files.length === 0) return [];

  const stride = spreadStride(files.length);
  const ordered: string[] = [];
  for (let i = 0; i < files.length; i++) {
    ordered.push(encodeURI(`/images/${FOLDER}/${files[(i * stride) % files.length]}`));
  }
  return ordered;
}
