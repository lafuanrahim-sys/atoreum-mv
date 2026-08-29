import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * The photographs behind the cursor trail on the About page.
 *
 * One named folder, chosen deliberately: public/images/Cursor Move Image.
 * Everything in it is used, and a file dropped in later appears on its own,
 * so the set is curated by moving files rather than by editing this.
 *
 * Each photograph's real dimensions come back with it. The frame used to be
 * fixed at 4:5 because the first batch all were -- but only 80 of the 174 are,
 * and the rest were being cropped to fit it, some badly: the tallest is 0.27
 * wide-to-high and lost roughly two thirds of its height. The component sizes
 * every frame from these, so nothing is cut off.
 *
 * Read at build time, once, for a static page.
 */

export type TrailPhoto = {
  src: string;
  width: number;
  height: number;
};

const FOLDER = "Cursor Move Image";
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;

export async function listCursorTrailPhotos(): Promise<TrailPhoto[]> {
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

  const photos = await Promise.all(
    files.map(async (file): Promise<TrailPhoto | null> => {
      try {
        // Header only -- this does not decode the image.
        const { width, height } = await sharp(path.join(dir, file)).metadata();
        if (!width || !height) return null;
        return { src: encodeURI(`/images/${FOLDER}/${file}`), width, height };
      } catch (err) {
        // One unreadable file should not cost the other 173.
        console.error(`[cursorTrailPhotos] skipping ${file}:`, err);
        return null;
      }
    })
  );

  // Name order is fine to send: the component shuffles per visit, so what
  // arrives here only needs to be stable between server and client.
  return photos.filter((photo): photo is TrailPhoto => photo !== null);
}
