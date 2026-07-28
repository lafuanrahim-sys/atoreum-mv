/**
 * Coarse client-side device signal (BOLI_SPEC.md §6.1 item 4: "canvas + UA
 * + screen + timezone"). A flag-for-review signal only — never a block —
 * so this doesn't need to be robust against a determined adversary, just
 * cheap and stable across a normal user's sessions. Persisted in
 * localStorage so it survives reloads without recomputing the canvas
 * fingerprint every time.
 */

const STORAGE_KEY = "atoreum_boli_device_hash";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("atoreum-boli", 2, 2);
    return canvas.toDataURL();
  } catch {
    return "no-canvas";
  }
}

export async function getDeviceHash(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached) return cached;

    const parts = [
      navigator.userAgent,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasFingerprint(),
    ].join("|");

    const hash = await sha256Hex(parts);
    window.localStorage.setItem(STORAGE_KEY, hash);
    return hash;
  } catch {
    return null;
  }
}
