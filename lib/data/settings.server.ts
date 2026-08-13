import { pool } from "@/lib/db";

/**
 * Postgres-backed store settings (see lib/data/schema.sql, the
 * `store_settings` singleton table) — replaces the original JSON-on-disk
 * version, which didn't persist on Vercel's read-only/ephemeral serverless
 * filesystem. Same exported functions as before (now async).
 *
 * Bank-transfer details shown at checkout (previously hardcoded via env
 * vars in lib/bankDetails.ts, which now only supplies the first-run seed),
 * plus the site-wide maintenance-mode flag (see app/layout.tsx).
 */

/**
 * No SWIFT code. Every customer paying by transfer is paying from a Maldivian
 * account to a Maldivian one, where the account number is the whole
 * instruction — SWIFT is for international wires nobody here is sending, and
 * a field that means nothing to the person reading it only makes the transfer
 * look harder than it is. The `swift` column still exists in store_settings
 * (defaulted, written by nothing) rather than being dropped, so no migration
 * is needed to stop showing it.
 */
export type StoreSettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  maintenanceMode: boolean;
};

type SettingsRow = {
  bank_name: string;
  account_name: string;
  account_number: string;
  maintenance_mode: boolean;
};

function rowToSettings(row: SettingsRow): StoreSettings {
  return {
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    maintenanceMode: row.maintenance_mode,
  };
}

// The real account, so a fresh database is correct on its first read rather
// than showing a placeholder to a customer about to send money. Still
// overridable by env, and editable in Dashboard -> Settings.
const SEED_SETTINGS: StoreSettings = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Bank of Maldives",
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "ARANZO INVESTMENTS",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "7730000859425",
  maintenanceMode: false,
};

export async function getSettings(): Promise<StoreSettings> {
  const { rows } = await pool().query<SettingsRow>("select * from store_settings where id = true");
  if (rows[0]) return rowToSettings(rows[0]);
  await saveSettings(SEED_SETTINGS);
  return SEED_SETTINGS;
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await pool().query(
    `insert into store_settings (id, bank_name, account_name, account_number, maintenance_mode, updated_at)
     values (true, $1, $2, $3, $4, now())
     on conflict (id) do update set
       bank_name = excluded.bank_name,
       account_name = excluded.account_name,
       account_number = excluded.account_number,
       maintenance_mode = excluded.maintenance_mode,
       updated_at = now()`,
    [settings.bankName, settings.accountName, settings.accountNumber, settings.maintenanceMode]
  );
}

/** Narrow update for the maintenance-mode toggle -- doesn't require the
 * caller to already have the bank-transfer fields on hand. */
export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  const current = await getSettings();
  await saveSettings({ ...current, maintenanceMode: enabled });
}
