// Loads .env.local before any test file runs, the same way `next dev` does
// automatically — Vitest doesn't. This is what lets the Boli integration
// tests find SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY when they're set.
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });
