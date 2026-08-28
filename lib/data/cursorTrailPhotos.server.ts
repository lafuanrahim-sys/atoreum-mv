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

  // Name order is fine to send: the component shuffles per visit, so what
  // arrives here only needs to be stable between server and client.
  return files.map((file) => encodeURI(`/images/${FOLDER}/${file}`));
}
