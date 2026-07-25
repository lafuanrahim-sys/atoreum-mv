import fs from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guarded audio delivery. The files live in assets/audios (outside
 * public/), so there is no direct URL to them — this route is the only way
 * in, and it refuses anything that looks like a download rather than the
 * site playing its own sounds:
 *
 * - Navigating to the URL (address bar, link click, "save as") sends
 *   Sec-Fetch-Dest: document → 403.
 * - Requests from other origins (or with no referer, e.g. curl/wget) → 403.
 *
 * Honest limit: audio a browser can play can always be captured by a
 * determined user with devtools — this blocks the normal paths, which is
 * the most the web platform allows.
 */

const FILES: Record<string, string> = {
  "card-shuffling": "card-shuffling.mp3",
  "keyboard-sound": "keyboard-sound.mp3",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const file = FILES[name];
  if (!file) return new NextResponse(null, { status: 404 });

  const dest = request.headers.get("sec-fetch-dest");
  const referer = request.headers.get("referer");
  const sameOrigin = !!referer && referer.startsWith(request.nextUrl.origin);
  if (dest === "document" || !sameOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  try {
    const data = await fs.readFile(path.join(process.cwd(), "assets", "audios", file));
    // Download managers (IDM etc.) sniff media by content type and by the
    // MP3 byte signature. The payload is served as anonymous binary with
    // every byte XOR-masked — on the wire it is neither typed, named, nor
    // shaped like audio. lib/keySound.ts unmasks with the same key before
    // decoding.
    const masked = new Uint8Array(data);
    for (let i = 0; i < masked.length; i++) masked[i] ^= 0x5a;
    return new NextResponse(masked, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
