import { pool } from "@/lib/db";

/**
 * Postgres-backed store settings (see lib/data/schema.sql, the
 * `store_settings` singleton table) — replaces the original JSON-on-disk
 * version, which didn't persist on Vercel's read-only/ephemeral serverless
 * filesystem. Same exported functions as before (now async).
 *
 * Currently just the bank-transfer details shown at checkout, editable from
 * Dashboard → Settings (previously hardcoded via env vars in
 * lib/bankDetails.ts, which now only supplies the first-run seed).
 */

export type StoreSettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
};

type SettingsRow = {
  bank_name: string;
  account_name: string;
  account_number: string;
  swift: string;
};

function rowToSettings(row: SettingsRow): StoreSettings {
  return {
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNumber: row.account_number,
    swift: row.swift,
  };
}

const SEED_SETTINGS: StoreSettings = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Bank of Maldives (placeholder)",
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "Atoreum MV Pvt Ltd (placeholder)",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "0000-0000-0000 (placeholder)",
  swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "MALBMVMV (placeholder)",
};

export async function getSettings(): Promise<StoreSettings> {
  const { rows } = await pool().query<SettingsRow>("select * from store_settings where id = true");
  if (rows[0]) return rowToSettings(rows[0]);
  await saveSettings(SEED_SETTINGS);
  return SEED_SETTINGS;
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  await pool().query(
    `insert into store_settings (id, bank_name, account_name, account_number, swift, updated_at)
     values (true, $1, $2, $3, $4, now())
     on conflict (id) do update set
       bank_name = excluded.bank_name,
       account_name = excluded.account_name,
       account_number = excluded.account_number,
       swift = excluded.swift,
       updated_at = now()`,
    [settings.bankName, settings.accountName, settings.accountNumber, settings.swift]
  );
}
