import { pool } from "./db";
import { GAME_ENABLED, WEEKLY_GAME_BOLI_CAP, MONTHLY_GAME_BOLI_CAP, GLOBAL_DAILY_GAME_BOLI_BUDGET } from "./config";

/**
 * Live, no-deploy overrides for the handful of Boli Dive numbers the admin
 * dashboard can flip (BOLI_SPEC.md §5.5 kill switch, §8 "live toggles for
 * GAME_ENABLED and the three caps"). lib/boli/config.ts remains the single
 * source of DEFAULT values — every other Boli number is still read directly
 * from there, unchanged. A row in boli_runtime_config overrides exactly one
 * key until an admin changes or clears it; no row means "use the config.ts
 * default."
 */

export type RuntimeConfigKey = "game_enabled" | "weekly_cap" | "monthly_cap" | "global_daily_budget";

const DEFAULTS: Record<RuntimeConfigKey, boolean | number> = {
  game_enabled: GAME_ENABLED,
  weekly_cap: WEEKLY_GAME_BOLI_CAP,
  monthly_cap: MONTHLY_GAME_BOLI_CAP,
  global_daily_budget: GLOBAL_DAILY_GAME_BOLI_BUDGET,
};

export type RuntimeConfigRow = {
  key: RuntimeConfigKey;
  value: boolean | number;
  isOverridden: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Every key with its effective value (override if set, else the config.ts default) — for the admin toggle panel. */
export async function listRuntimeConfig(): Promise<RuntimeConfigRow[]> {
  const { rows } = await pool().query<{ key: string; value: unknown; updated_at: string; updated_by: string | null }>(
    `select key, value, updated_at, updated_by from boli_runtime_config`
  );
  const overrides = new Map(rows.map((r) => [r.key, r]));

  return (Object.keys(DEFAULTS) as RuntimeConfigKey[]).map((key) => {
    const override = overrides.get(key);
    return {
      key,
      value: override ? (override.value as boolean | number) : DEFAULTS[key],
      isOverridden: Boolean(override),
      updatedAt: override?.updated_at ?? null,
      updatedBy: override?.updated_by ?? null,
    };
  });
}

async function getOverride<T extends boolean | number>(key: RuntimeConfigKey): Promise<T | null> {
  const { rows } = await pool().query<{ value: T }>(`select value from boli_runtime_config where key = $1`, [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function getEffectiveGameEnabled(): Promise<boolean> {
  const override = await getOverride<boolean>("game_enabled");
  return override ?? GAME_ENABLED;
}

export async function getEffectiveCaps(): Promise<{
  weeklyCap: number;
  monthlyCap: number;
  globalDailyBudget: number;
}> {
  const [weekly, monthly, global] = await Promise.all([
    getOverride<number>("weekly_cap"),
    getOverride<number>("monthly_cap"),
    getOverride<number>("global_daily_budget"),
  ]);
  return {
    weeklyCap: weekly ?? WEEKLY_GAME_BOLI_CAP,
    monthlyCap: monthly ?? MONTHLY_GAME_BOLI_CAP,
    globalDailyBudget: global ?? GLOBAL_DAILY_GAME_BOLI_BUDGET,
  };
}

/** Sets (or replaces) a live override. Attributed, like every other Boli admin write (BOLI_SPEC.md §6.6 ethos). */
export async function setRuntimeConfig(key: RuntimeConfigKey, value: boolean | number, adminId: string): Promise<void> {
  await pool().query(
    `insert into boli_runtime_config (key, value, updated_at, updated_by)
     values ($1, $2, now(), $3)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [key, JSON.stringify(value), adminId]
  );
}

/** Removes an override, reverting the key to its config.ts default. */
export async function clearRuntimeConfig(key: RuntimeConfigKey): Promise<void> {
  await pool().query(`delete from boli_runtime_config where key = $1`, [key]);
}
