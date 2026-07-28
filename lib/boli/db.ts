/**
 * Boli's Postgres pool now lives in lib/db.ts, shared with the rest of the
 * storefront's data layer (see lib/data/schema.sql) once both were migrated
 * onto the same Supabase database. Re-exported here so every existing
 * `import { pool } from "@/lib/boli/db"` call site keeps working unchanged.
 */
export { pool } from "@/lib/db";
