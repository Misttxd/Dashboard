import "server-only";
import { env } from "../config";
import { finishSync, get, run, setSetting, getSetting, startSync, tx } from "../db";

/**
 * Trading 212 Public API — READ ONLY.
 *
 * This client deliberately implements no order, pie-modification or withdrawal
 * endpoint. Nothing here can move money or place a trade; the dashboard mirrors
 * the account and nothing more.
 *
 * The API is in beta and rate limits are tight and per-endpoint, so every call
 * goes through `request()` which serialises them and backs off on 429.
 */

const PATHS = {
  cash: "/api/v0/equity/account/cash",
  info: "/api/v0/equity/account/info",
  portfolio: "/api/v0/equity/portfolio",
  instruments: "/api/v0/equity/metadata/instruments",
  dividends: "/api/v0/history/dividends",
  transactions: "/api/v0/history/transactions",
} as const;

function baseUrl(): string {
  return env.trading212.environment === "demo"
    ? "https://demo.trading212.com"
    : "https://live.trading212.com";
}

/** Serialises requests: T212 429s aggressively on concurrent calls. */
let chain: Promise<unknown> = Promise.resolve();

function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function request<T>(path: string, attempt = 0): Promise<T> {
  if (!env.trading212.apiKey) {
    throw new Error("No Trading 212 API key set (T212_API_KEY).");
  }

  return serialise(async () => {
    const res = await fetch(`${baseUrl()}${path}`, {
      headers: {
        Authorization: env.trading212.apiKey,
        Accept: "application/json",
      },
    });

    if (res.status === 429) {
      if (attempt >= 4) {
        throw new Error(
          "Trading 212 rate limit — the API allows only a few calls per minute. Try again shortly.",
        );
      }
      const wait = 2000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      return request<T>(path, attempt + 1);
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Trading 212 rejected the API key. Check it is for the right account and that the required scopes are enabled.",
      );
    }

    if (!res.ok) {
      throw new Error(`Trading 212 ${path} failed (${res.status}): ${await res.text()}`);
    }

    // Some endpoints return an empty body on no-content.
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  });
}

/* -------------------------------------------------------------------------- */
/* Response shapes                                                             */
/* -------------------------------------------------------------------------- */

interface Cash {
  free?: number;
  total?: number;
  invested?: number;
  ppl?: number;
  result?: number;
  blocked?: number | null;
}

interface AccountInfo {
  id?: number;
  currencyCode?: string;
}

interface Position {
  ticker: string;
  quantity?: number;
  averagePrice?: number;
  currentPrice?: number;
  ppl?: number;
  fxPpl?: number | null;
  initialFillDate?: string;
}

interface Instrument {
  ticker: string;
  name?: string;
  shortName?: string;
  type?: string;
  currencyCode?: string;
  isin?: string;
}

interface Paginated<T> {
  items?: T[];
  nextPagePath?: string | null;
}

interface Dividend {
  reference?: string;
  ticker?: string;
  amount?: number;
  grossAmountPerShare?: number;
  amountInEuro?: number;
  paidOn?: string;
  type?: string;
}

interface Transaction {
  reference?: string;
  type?: string;
  amount?: number;
  dateTime?: string;
}

/* -------------------------------------------------------------------------- */
/* Instrument metadata (heavily rate limited — cached for a week)              */
/* -------------------------------------------------------------------------- */

const INSTRUMENTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function refreshInstrumentsIfStale(): Promise<void> {
  const last = getSetting("t212:instruments_fetched_at");
  if (last && Date.now() - Date.parse(last) < INSTRUMENTS_TTL_MS) return;

  // This endpoint is limited to roughly one call per minute; failing to fetch
  // it is not fatal — we simply show raw tickers until it next succeeds.
  try {
    const list = await request<Instrument[]>(PATHS.instruments);
    if (!Array.isArray(list)) return;

    tx(() => {
      for (const i of list) {
        run(
          `INSERT INTO instruments (ticker, name, short_name, type, currency, isin)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(ticker) DO UPDATE SET
             name = excluded.name, short_name = excluded.short_name,
             type = excluded.type, currency = excluded.currency, isin = excluded.isin`,
          i.ticker,
          i.name ?? null,
          i.shortName ?? null,
          i.type ?? null,
          i.currencyCode ?? null,
          i.isin ?? null,
        );
      }
    });
    setSetting("t212:instruments_fetched_at", new Date().toISOString());
  } catch {
    // Non-fatal by design.
  }
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

async function syncDividends(): Promise<number> {
  let path: string | null = `${PATHS.dividends}?limit=50`;
  let count = 0;
  let pages = 0;

  while (path && pages < 20) {
    const page: Paginated<Dividend> = await request<Paginated<Dividend>>(path);
    const items = page?.items ?? [];
    if (items.length === 0) break;

    tx(() => {
      for (const d of items) {
        const id = d.reference ?? `${d.ticker}-${d.paidOn}`;
        if (!id) continue;
        run(
          `INSERT INTO dividends (id, ticker, amount, gross_amount, currency, paid_on, raw)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             amount = excluded.amount, gross_amount = excluded.gross_amount,
             paid_on = excluded.paid_on, raw = excluded.raw`,
          id,
          d.ticker ?? null,
          d.amount ?? null,
          d.grossAmountPerShare ?? null,
          null,
          d.paidOn ?? null,
          JSON.stringify(d),
        );
        count++;
      }
    });

    path = page.nextPagePath ?? null;
    pages++;
  }
  return count;
}

async function syncTransactions(): Promise<number> {
  let path: string | null = `${PATHS.transactions}?limit=50`;
  let count = 0;
  let pages = 0;

  while (path && pages < 20) {
    const page: Paginated<Transaction> = await request<Paginated<Transaction>>(path);
    const items = page?.items ?? [];
    if (items.length === 0) break;

    tx(() => {
      for (const t of items) {
        if (!t.reference) continue;
        run(
          `INSERT INTO transactions (id, type, amount, currency, date, raw)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             type = excluded.type, amount = excluded.amount, date = excluded.date, raw = excluded.raw`,
          t.reference,
          t.type ?? null,
          t.amount ?? null,
          null,
          t.dateTime ?? null,
          JSON.stringify(t),
        );
        count++;
      }
    });

    path = page.nextPagePath ?? null;
    pages++;
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/* Main sync                                                                   */
/* -------------------------------------------------------------------------- */

export async function syncTrading212(): Promise<number> {
  const syncId = startSync("trading212");
  try {
    const info = await request<AccountInfo>(PATHS.info).catch(() => null);
    const cash = await request<Cash>(PATHS.cash);
    const portfolio = await request<Position[]>(PATHS.portfolio);
    const now = new Date().toISOString();

    tx(() => {
      run(
        `INSERT INTO account_snapshots (taken_at, currency, free, total, invested, ppl, result, blocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        now,
        info?.currencyCode ?? null,
        cash?.free ?? null,
        cash?.total ?? null,
        cash?.invested ?? null,
        cash?.ppl ?? null,
        cash?.result ?? null,
        cash?.blocked ?? null,
      );

      // Positions are a full mirror: anything sold no longer appears.
      run("DELETE FROM positions");
      for (const p of portfolio ?? []) {
        run(
          `INSERT INTO positions
             (ticker, quantity, avg_price, current_price, ppl, fx_ppl, initial_fill_date, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          p.ticker,
          p.quantity ?? null,
          p.averagePrice ?? null,
          p.currentPrice ?? null,
          p.ppl ?? null,
          p.fxPpl ?? null,
          p.initialFillDate ?? null,
          now,
        );
      }
    });

    if (info?.currencyCode) setSetting("t212:currency", info.currencyCode);

    await refreshInstrumentsIfStale();

    // History is best-effort: a rate limit here must not fail the whole sync.
    let history = 0;
    try {
      history += await syncDividends();
      history += await syncTransactions();
    } catch {
      /* ignore */
    }

    const records = (portfolio?.length ?? 0) + history;
    finishSync(syncId, "ok", records);
    return records;
  } catch (err) {
    finishSync(syncId, "error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export function accountCurrency(): string {
  return getSetting("t212:currency") ?? "EUR";
}

export function latestSnapshot() {
  return get<{
    taken_at: string;
    currency: string | null;
    free: number | null;
    total: number | null;
    invested: number | null;
    ppl: number | null;
    result: number | null;
  }>("SELECT * FROM account_snapshots ORDER BY id DESC LIMIT 1");
}
