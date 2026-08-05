import { pool } from "@/lib/db";
import type { FxDashboardSummary, FxExchange, FxSettings, FxTtPayment } from "@/lib/types";

/**
 * Dollar exchange tracker data layer (see lib/data/schema.sql's fx_* tables
 * and lib/types.ts's Fx* types). Every derived money figure below is read
 * straight off a Postgres generated column, never recomputed here — the
 * app never touches money arithmetic, only formatting.
 */

/* -------------------------------- settings ------------------------------- */

type FxSettingsRow = {
  ceiling_rate: string;
  bank_tt_rate: string;
  latest_market_rate: string;
  updated_at: string;
  updated_by: string | null;
};

function rowToFxSettings(row: FxSettingsRow): FxSettings {
  return {
    ceilingRate: Number(row.ceiling_rate),
    bankTtRate: Number(row.bank_tt_rate),
    latestMarketRate: Number(row.latest_market_rate),
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
  };
}

export async function getFxSettings(): Promise<FxSettings> {
  const { rows } = await pool().query<FxSettingsRow>("select * from fx_settings where id = true");
  // The row is seeded by schema.sql (insert ... on conflict do nothing), so
  // this should never be empty outside of a schema that hasn't been applied.
  return rowToFxSettings(rows[0]);
}

export async function saveFxSettings(input: {
  ceilingRate: number;
  bankTtRate: number;
  latestMarketRate: number;
  updatedBy: string | null;
}): Promise<FxSettings> {
  const { rows } = await pool().query<FxSettingsRow>(
    `update fx_settings
       set ceiling_rate = $1, bank_tt_rate = $2, latest_market_rate = $3,
           updated_by = $4, updated_at = now()
     where id = true
     returning *`,
    [input.ceilingRate, input.bankTtRate, input.latestMarketRate, input.updatedBy]
  );
  return rowToFxSettings(rows[0]);
}

/** Narrower than saveFxSettings -- only touches the market rate, for the
 * Telegram auto-fetch cron. Leaves ceilingRate/bankTtRate (business
 * decisions, not scraped) untouched. */
export async function updateFxLatestMarketRate(rate: number, updatedBy: string): Promise<FxSettings> {
  const { rows } = await pool().query<FxSettingsRow>(
    `update fx_settings
       set latest_market_rate = $1, updated_by = $2, updated_at = now()
     where id = true
     returning *`,
    [rate, updatedBy]
  );
  return rowToFxSettings(rows[0]);
}

/* -------------------------------- exchanges ------------------------------- */

type FxExchangeRow = {
  id: string;
  trade_date: string;
  counterparty: string;
  usd_amount: string;
  buy_rate: string;
  market_rate: string;
  ceiling_rate: string;
  sell_rate: string | null;
  notes: string;
  created_at: string;
  created_by: string | null;
  mvr_paid: string;
  cost_at_ceiling: string;
  profit_vs_ceiling: string;
  unrealized_vs_market: string;
  realized_profit: string | null;
};

function rowToFxExchange(row: FxExchangeRow): FxExchange {
  return {
    id: row.id,
    tradeDate: row.trade_date,
    counterparty: row.counterparty,
    usdAmount: Number(row.usd_amount),
    buyRate: Number(row.buy_rate),
    marketRate: Number(row.market_rate),
    ceilingRate: Number(row.ceiling_rate),
    sellRate: row.sell_rate !== null ? Number(row.sell_rate) : null,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    mvrPaid: Number(row.mvr_paid),
    costAtCeiling: Number(row.cost_at_ceiling),
    profitVsCeiling: Number(row.profit_vs_ceiling),
    unrealizedVsMarket: Number(row.unrealized_vs_market),
    realizedProfit: row.realized_profit !== null ? Number(row.realized_profit) : null,
  };
}

export async function listFxExchanges(): Promise<FxExchange[]> {
  const { rows } = await pool().query<FxExchangeRow>(
    "select * from fx_exchanges order by trade_date desc, created_at desc"
  );
  return rows.map(rowToFxExchange);
}

export async function getFxExchange(id: string): Promise<FxExchange | null> {
  const { rows } = await pool().query<FxExchangeRow>("select * from fx_exchanges where id = $1", [id]);
  return rows[0] ? rowToFxExchange(rows[0]) : null;
}

export async function createFxExchange(input: {
  tradeDate: string;
  counterparty: string;
  usdAmount: number;
  buyRate: number;
  marketRate: number;
  ceilingRate: number;
  sellRate: number | null;
  notes: string;
  createdBy: string | null;
}): Promise<FxExchange> {
  const { rows } = await pool().query<FxExchangeRow>(
    `insert into fx_exchanges
       (trade_date, counterparty, usd_amount, buy_rate, market_rate, ceiling_rate, sell_rate, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      input.tradeDate,
      input.counterparty,
      input.usdAmount,
      input.buyRate,
      input.marketRate,
      input.ceilingRate,
      input.sellRate,
      input.notes,
      input.createdBy,
    ]
  );
  return rowToFxExchange(rows[0]);
}

export async function updateFxExchange(
  id: string,
  input: {
    tradeDate: string;
    counterparty: string;
    usdAmount: number;
    buyRate: number;
    marketRate: number;
    ceilingRate: number;
    sellRate: number | null;
    notes: string;
  }
): Promise<FxExchange | null> {
  const { rows } = await pool().query<FxExchangeRow>(
    `update fx_exchanges
       set trade_date = $1, counterparty = $2, usd_amount = $3, buy_rate = $4,
           market_rate = $5, ceiling_rate = $6, sell_rate = $7, notes = $8
     where id = $9
     returning *`,
    [
      input.tradeDate,
      input.counterparty,
      input.usdAmount,
      input.buyRate,
      input.marketRate,
      input.ceilingRate,
      input.sellRate,
      input.notes,
      id,
    ]
  );
  return rows[0] ? rowToFxExchange(rows[0]) : null;
}

export async function deleteFxExchange(id: string): Promise<void> {
  await pool().query("delete from fx_exchanges where id = $1", [id]);
}

/* ------------------------------- tt payments ------------------------------ */

type FxTtRow = {
  id: string;
  tt_date: string;
  reference: string;
  purpose: string;
  tt_amount: string;
  support_pct: string;
  bank_rate: string;
  market_rate: string;
  notes: string;
  created_at: string;
  created_by: string | null;
  usd_via_bank: string;
  usd_from_own: string;
  cash_paid_mvr: string;
  own_usd_at_bank_rate: string;
  cost_own_usd_mvr: string;
  opportunity_cost: string;
  total_effective_cost: string;
  cost_no_support: string;
  cash_saved_today: string;
  total_saved_incl_opp: string;
};

function rowToFxTtPayment(row: FxTtRow): FxTtPayment {
  return {
    id: row.id,
    ttDate: row.tt_date,
    reference: row.reference,
    purpose: row.purpose,
    ttAmount: Number(row.tt_amount),
    supportPct: Number(row.support_pct),
    bankRate: Number(row.bank_rate),
    marketRate: Number(row.market_rate),
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    usdViaBank: Number(row.usd_via_bank),
    usdFromOwn: Number(row.usd_from_own),
    cashPaidMvr: Number(row.cash_paid_mvr),
    ownUsdAtBankRate: Number(row.own_usd_at_bank_rate),
    costOwnUsdMvr: Number(row.cost_own_usd_mvr),
    opportunityCost: Number(row.opportunity_cost),
    totalEffectiveCost: Number(row.total_effective_cost),
    costNoSupport: Number(row.cost_no_support),
    cashSavedToday: Number(row.cash_saved_today),
    totalSavedInclOpp: Number(row.total_saved_incl_opp),
  };
}

export async function listFxTtPayments(): Promise<FxTtPayment[]> {
  const { rows } = await pool().query<FxTtRow>("select * from fx_tt_payments order by tt_date desc, created_at desc");
  return rows.map(rowToFxTtPayment);
}

export async function getFxTtPayment(id: string): Promise<FxTtPayment | null> {
  const { rows } = await pool().query<FxTtRow>("select * from fx_tt_payments where id = $1", [id]);
  return rows[0] ? rowToFxTtPayment(rows[0]) : null;
}

export async function createFxTtPayment(input: {
  ttDate: string;
  reference: string;
  purpose: string;
  ttAmount: number;
  supportPct: number;
  bankRate: number;
  marketRate: number;
  notes: string;
  createdBy: string | null;
}): Promise<FxTtPayment> {
  const { rows } = await pool().query<FxTtRow>(
    `insert into fx_tt_payments
       (tt_date, reference, purpose, tt_amount, support_pct, bank_rate, market_rate, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      input.ttDate,
      input.reference,
      input.purpose,
      input.ttAmount,
      input.supportPct,
      input.bankRate,
      input.marketRate,
      input.notes,
      input.createdBy,
    ]
  );
  return rowToFxTtPayment(rows[0]);
}

export async function updateFxTtPayment(
  id: string,
  input: {
    ttDate: string;
    reference: string;
    purpose: string;
    ttAmount: number;
    supportPct: number;
    bankRate: number;
    marketRate: number;
    notes: string;
  }
): Promise<FxTtPayment | null> {
  const { rows } = await pool().query<FxTtRow>(
    `update fx_tt_payments
       set tt_date = $1, reference = $2, purpose = $3, tt_amount = $4, support_pct = $5,
           bank_rate = $6, market_rate = $7, notes = $8
     where id = $9
     returning *`,
    [
      input.ttDate,
      input.reference,
      input.purpose,
      input.ttAmount,
      input.supportPct,
      input.bankRate,
      input.marketRate,
      input.notes,
      id,
    ]
  );
  return rows[0] ? rowToFxTtPayment(rows[0]) : null;
}

export async function deleteFxTtPayment(id: string): Promise<void> {
  await pool().query("delete from fx_tt_payments where id = $1", [id]);
}

/* -------------------------------- dashboard -------------------------------- */

type FxDashboardRow = {
  usd_bought: string;
  usd_used: string;
  usd_balance: string;
  avg_buy_rate: string | null;
  mvr_paid: string;
  profit_vs_ceiling: string;
  profit_vs_market: string;
  realized_profit: string;
  tt_total: string;
  cash_paid: string;
  cost_no_support: string;
  cash_saved: string;
  saved_incl_opp: string;
  total_value_created: string;
};

export async function getFxDashboard(): Promise<FxDashboardSummary> {
  const { rows } = await pool().query<FxDashboardRow>("select * from fx_dashboard");
  const row = rows[0];
  return {
    usdBought: Number(row.usd_bought),
    usdUsed: Number(row.usd_used),
    usdBalance: Number(row.usd_balance),
    avgBuyRate: row.avg_buy_rate !== null ? Number(row.avg_buy_rate) : null,
    mvrPaid: Number(row.mvr_paid),
    profitVsCeiling: Number(row.profit_vs_ceiling),
    profitVsMarket: Number(row.profit_vs_market),
    realizedProfit: Number(row.realized_profit),
    ttTotal: Number(row.tt_total),
    cashPaid: Number(row.cash_paid),
    costNoSupport: Number(row.cost_no_support),
    cashSaved: Number(row.cash_saved),
    savedInclOpp: Number(row.saved_incl_opp),
    totalValueCreated: Number(row.total_value_created),
  };
}
