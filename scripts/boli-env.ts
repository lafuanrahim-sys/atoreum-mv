// Standalone Boli scripts run outside Next.js's own build pipeline (via
// `tsx`), so unlike `next dev`/`next build` they don't automatically load
// .env.local. Import this file FIRST, before any lib/boli/* import, in
// every script under scripts/boli-*.ts.
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });
