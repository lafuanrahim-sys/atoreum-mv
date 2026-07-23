import fs from "fs";
import path from "path";

/**
 * Store settings — currently the bank-transfer details shown at checkout,
 * editable from Dashboard → Settings (previously hardcoded via env vars in
 * lib/bankDetails.ts, which now only supplies the first-run seed).
 *
 * Same Supabase-swappable pattern as the other stores: JSON-on-disk,
 * server-only, auto-seeded, all access through the exported functions so a
 * later migration touches only this file.
 */

const DATA_PATH = path.join(process.cwd(), "data", "settings.json");

export type StoreSettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
};

const SEED_SETTINGS: StoreSettings = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Bank of Maldives (placeholder)",
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "Atoreum MV Pvt Ltd (placeholder)",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "0000-0000-0000 (placeholder)",
  swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "MALBMVMV (placeholder)",
};

export function getSettings(): StoreSettings {
  if (!fs.existsSync(DATA_PATH)) {
    saveSettings(SEED_SETTINGS);
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return { ...SEED_SETTINGS, ...(JSON.parse(raw) as Partial<StoreSettings>) };
}

export function saveSettings(settings: StoreSettings) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}
