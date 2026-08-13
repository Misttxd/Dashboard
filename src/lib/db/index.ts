import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

/**
 * Single shared handle to the local SQLite file.
 *
 * Cached on globalThis because Next's dev server re-evaluates modules on every
 * hot reload; without this we would leak a file handle per edit.
 */
const DB_PATH =
  process.env.DASHBOARD_DB_PATH ??
  path.join(process.cwd(), "data", "dashboard.db");

declare global {
  // eslint-disable-next-line no-var
  var __dashboardDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);

  // WAL keeps reads non-blocking while a sync writes. NORMAL sync is the right
  // durability/speed trade for a single-user local app.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__dashboardDb) globalThis.__dashboardDb = open();
  return globalThis.__dashboardDb;
}

/* -------------------------------------------------------------------------- */
/* Typed query helpers                                                         */
/* -------------------------------------------------------------------------- */

type Param = string | number | bigint | null | Uint8Array;

/**
 * node:sqlite returns rows with a *null prototype*. React Server Components
 * refuse to serialise those across the server/client boundary ("Only plain
 * objects ... can be passed to Client Components"), so every row is spread into
 * a normal object here rather than at each call site.
 */
export function all<T>(sql: string, ...params: Param[]): T[] {
  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row })) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = getDb().prepare(sql).get(...params);
  return row === undefined ? undefined : ({ ...row } as T);
}

export function run(sql: string, ...params: Param[]) {
  return getDb().prepare(sql).run(...params);
}

/** Wraps `fn` in a transaction; rolls back if it throws. */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function getSetting(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)
    ?.value;
}

export function getSettingJson<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString(),
  );
}

export function setSettingJson(key: string, value: unknown): void {
  setSetting(key, JSON.stringify(value));
}

/* -------------------------------------------------------------------------- */
/* OAuth tokens                                                                */
/* -------------------------------------------------------------------------- */

export interface OAuthToken {
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
  external_id: string | null;
  updated_at: string;
}

export function getToken(provider: string): OAuthToken | undefined {
  return get<OAuthToken>("SELECT * FROM oauth_tokens WHERE provider = ?", provider);
}

export function saveToken(
  provider: string,
  t: {
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    scope?: string | null;
    external_id?: string | null;
  },
): void {
  run(
    `INSERT INTO oauth_tokens
       (provider, access_token, refresh_token, expires_at, scope, external_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token  = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
       expires_at    = excluded.expires_at,
       scope         = COALESCE(excluded.scope, oauth_tokens.scope),
       external_id   = COALESCE(excluded.external_id, oauth_tokens.external_id),
       updated_at    = excluded.updated_at`,
    provider,
    t.access_token ?? null,
    t.refresh_token ?? null,
    t.expires_at ?? null,
    t.scope ?? null,
    t.external_id ?? null,
    new Date().toISOString(),
  );
}

export function deleteToken(provider: string): void {
  run("DELETE FROM oauth_tokens WHERE provider = ?", provider);
}

/* -------------------------------------------------------------------------- */
/* Sync log                                                                    */
/* -------------------------------------------------------------------------- */

export interface SyncLogRow {
  id: number;
  provider: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "error";
  records: number;
  message: string | null;
}

export function startSync(provider: string): number {
  const res = run(
    "INSERT INTO sync_log (provider, started_at, status) VALUES (?, ?, 'running')",
    provider,
    new Date().toISOString(),
  );
  return Number(res.lastInsertRowid);
}

export function finishSync(
  id: number,
  status: "ok" | "error",
  records: number,
  message?: string,
): void {
  run(
    "UPDATE sync_log SET finished_at = ?, status = ?, records = ?, message = ? WHERE id = ?",
    new Date().toISOString(),
    status,
    records,
    message ?? null,
    id,
  );
}

/** Most recent completed sync per provider, for the Settings page. */
export function lastSync(provider: string): SyncLogRow | undefined {
  return get<SyncLogRow>(
    "SELECT * FROM sync_log WHERE provider = ? ORDER BY id DESC LIMIT 1",
    provider,
  );
}
