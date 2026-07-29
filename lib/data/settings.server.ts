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

export type StoreSettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  maintenanceMode: boolean;
};

type SettingsRow = {
  bank_name: string;
  account_name: string;
  account_number: string;
  swift: string;
  maintenance_mode: boolean;
};

function rowToSettings(row: SettingsRow): StoreSettings {
  return {
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    swift: row.swift,
    maintenanceMode: row.maintenance_mode,
  };
}

const SEED_SETTINGS: StoreSettings = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Bank of Maldives (placeholder)",
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "Atoreum MV Pvt Ltd (placeholder)",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "0000-0000-0000 (placeholder)",
  swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "MALBMVMV (placeholder)",
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
    `insert into store_settings (id, bank_name, account_name, account_number, swift, maintenance_mode, updated_at)
     values (true, $1, $2, $3, $4, $5, now())
     on conflict (id) do update set
       bank_name = excluded.bank_name,
       account_name = excluded.account_name,
       account_number = excluded.account_number,
       swift = excluded.swift,
       maintenance_mode = excluded.maintenance_mode,
       updated_at = now()`,
    [settings.bankName, settings.accountName, settings.accountNumber, settings.swift, settings.maintenanceMode]
  );
}

/** Narrow update for the maintenance-mode toggle -- doesn't require the
 * caller to already have the bank-transfer fields on hand. */
export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  const current = await getSettings();
  await saveSettings({ ...current, maintenanceMode: enabled });
}
