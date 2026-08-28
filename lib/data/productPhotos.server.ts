import fs from "node:fs";
import path from "node:path";

/**
 * Every real product photograph in public/images.
 *
 * Read from the folder rather than listed by hand, so a photo dropped into
 * public/images/<Product Name>/ appears on its own -- the trail this feeds
 * previously named five files inline, which meant the other twenty-six were
 * shot, paid for, and never seen by anyone.
 *
 * public/images also holds category icons, hero art and the generic
 * placeholder set under products/. Those are not product photography and are
 * skipped by name; everything else at that level is a product folder.
 */

const NOT_PRODUCT_FOLDERS = new Set(["categories", "hero", "products", "produc gallery"]);
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;

export function listProductPhotos(): string[] {
  const root = path.join(process.cwd(), "public", "images");

  let folders: string[];
  try {
    folders = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !NOT_PRODUCT_FOLDERS.has(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    // A missing folder is not worth a broken page: the component keeps its
    // own fallback list, so the section still works.
    console.error("[productPhotos] could not read public/images:", err);
    return [];
  }

  const byProduct = folders
    .map((folder) => {
      try {
        return fs
          .readdirSync(path.join(root, folder))
          .filter((file) => IMAGE_EXTENSION.test(file))
          .sort()
          .map((file) => encodeURI(`/images/${folder}/${file}`));
      } catch {
        return [];
      }
    })
    .filter((photos) => photos.length > 0);

  /**
   * Interleaved one per product rather than concatenated.
   *
   * Sorted by folder, the six mask-pack photos would arrive as six near
   * identical images in a row while the products with a single photo waited
   * at the end. Round-robin means consecutive images are different products,
   * and every product shows up in the first pass.
   */
  const longest = byProduct.reduce((max, photos) => Math.max(max, photos.length), 0);
  const ordered: string[] = [];
  for (let i = 0; i < longest; i++) {
    for (const photos of byProduct) {
      if (photos[i]) ordered.push(photos[i]);
    }
  }
  return ordered;
}
