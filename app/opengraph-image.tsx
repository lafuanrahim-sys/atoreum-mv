import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/**
 * The picture that appears when the site is pasted into WhatsApp, Instagram,
 * Facebook or a search result preview.
 *
 * Generated rather than a designed file: it is built at build time, cached,
 * and stays correct if the brand line changes — and a wrong-sized or missing
 * OG image is the difference between a link that looks like a shop and a link
 * that looks like spam. Most of this store's traffic arrives as a pasted link.
 *
 * Deliberately set in the renderer's built-in face rather than the site's
 * Playfair. Fonts for ImageResponse must be read off disk as binary, and
 * next/font does not expose the file; fetching a webfont at build time would
 * add a network failure mode to the build for a small gain in fidelity.
 */
export const alt = "Atoreum MV — Korean skincare in the Maldives";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // The site's own ink/gold, hard-coded: CSS custom properties don't
          // exist in this renderer.
          background: "#14170f",
          color: "#f4f1e8",
        }}
      >
        <div
          style={{
            fontSize: 34,
            letterSpacing: 18,
            textTransform: "uppercase",
            color: "#c9a227",
            display: "flex",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 76, marginTop: 28, display: "flex", textAlign: "center" }}>
          Korean Skincare, Delivered in Malé
        </div>
        <div style={{ fontSize: 30, marginTop: 30, color: "#a8a89a", display: "flex" }}>
          Lebelage · cleansers, serums, masks & sun care
        </div>
        <div
          style={{
            marginTop: 46,
            width: 190,
            height: 2,
            background: "#c9a227",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
