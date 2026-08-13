import "server-only";
import crypto from "node:crypto";
import { env } from "../config";
import { finishSync, run, startSync, tx } from "../db";
import { daysAgoLocal, dayRange, todayLocal, toCzechDay } from "../util/date";

/**
 * UNOFFICIAL Kalorické tabulky client.
 *
 * kaloricketabulky.cz publishes no API. This drives the same JSON endpoints the
 * website's own frontend uses, which means it can break without warning if they
 * change anything. Every failure is therefore caught and surfaced as a normal
 * sync error — a broken KT never takes the rest of the dashboard down, and
 * manual nutrition entry keeps working regardless.
 *
 * Read-only: we never write anything back to your KT account.
 */

const BASE = "https://www.kaloricketabulky.cz";

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
}

let cachedCookies: { value: string; at: number } | null = null;
const SESSION_TTL_MS = 20 * 60 * 1000;

/**
 * KT's login takes an MD5 of the password rather than the password itself.
 * That is their scheme, not a choice we get to make — we just have to match it.
 */
async function login(): Promise<string> {
  if (!env.kaloricke.email || !env.kaloricke.password) {
    throw new Error("Kalorické tabulky credentials are not set (KT_EMAIL / KT_PASSWORD).");
  }

  if (cachedCookies && Date.now() - cachedCookies.at < SESSION_TTL_MS) {
    return cachedCookies.value;
  }

  const res = await fetch(`${BASE}/login/create?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.kaloricke.email,
      password: crypto
        .createHash("md5")
        .update(env.kaloricke.password)
        .digest("hex"),
    }),
  });

  if (!res.ok) {
    throw new Error(`KT login failed with HTTP ${res.status}.`);
  }

  const body = (await res.json()) as ApiResponse;
  if (body.code !== 0) {
    throw new Error("KT rejected the login — check KT_EMAIL and KT_PASSWORD.");
  }

  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!cookies) throw new Error("KT login returned no session cookie.");

  cachedCookies = { value: cookies, at: Date.now() };
  return cookies;
}

/** Raw day summary, exactly as KT returns it. */
export async function fetchDaySummary(day: string): Promise<Record<string, unknown>> {
  const cookies = await login();
  const res = await fetch(
    `${BASE}/statistic/summary/${toCzechDay(day)}/get?format=json`,
    { headers: { Cookie: cookies, Accept: "application/json" } },
  );

  if (!res.ok) throw new Error(`KT summary for ${day} failed with HTTP ${res.status}.`);

  const body = (await res.json()) as ApiResponse<Record<string, unknown>>;
  if (body.code !== 0) {
    cachedCookies = null; // most likely an expired session
    throw new Error(`KT returned code ${body.code} for ${day}.`);
  }
  return body.data ?? {};
}

/**
 * KT's field names are not documented and have varied over time, so rather than
 * hard-coding a shape we search the response for the first numeric value under
 * any known alias. `rawKeys` from `inspectDay()` is how you extend this list
 * once you have seen a real payload.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  calories_kcal: ["energy", "energyKcal", "kcal", "calories", "dayEnergy", "sumEnergy"],
  protein_g: ["protein", "proteins", "dayProtein", "sumProtein"],
  carbs_g: ["carbohydrate", "carbohydrates", "carbs", "sacharidy", "dayCarbohydrate"],
  fat_g: ["fat", "fats", "tuky", "dayFat"],
  fiber_g: ["fibre", "fiber", "vlaknina"],
  sugar_g: ["sugar", "sugars", "cukry"],
  salt_g: ["salt", "sodium", "sul"],
  water_ml: ["water", "drink", "voda"],
};

/** Depth-first search for `key` anywhere in the payload, returning a number. */
function findNumber(obj: unknown, aliases: string[], depth = 0): number | null {
  if (depth > 6 || obj === null || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(record)) {
    const normalised = k.toLowerCase();
    if (aliases.some((a) => normalised === a.toLowerCase())) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v.replace(",", "."));
        if (Number.isFinite(n)) return n;
      }
      // Some fields arrive as { value: 123, unit: 'g' }
      if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
        const inner = (v as Record<string, unknown>).value;
        if (typeof inner === "number") return inner;
      }
    }
  }

  for (const v of Object.values(record)) {
    if (v && typeof v === "object") {
      const found = findNumber(v, aliases, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Diagnostic helper: shows the real payload so field mapping can be finished. */
export async function inspectDay(day: string) {
  const data = await fetchDaySummary(day);
  return {
    topLevelKeys: Object.keys(data),
    extracted: Object.fromEntries(
      Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
        field,
        findNumber(data, aliases),
      ]),
    ),
    raw: data,
  };
}

interface WeightPoint {
  description: string;
  value: number;
}

function saveWeights(data: Record<string, unknown>): void {
  const month = data.monthWeight;
  if (!Array.isArray(month)) return;

  for (const point of month as WeightPoint[]) {
    if (!point?.description || typeof point.value !== "number") continue;

    // 'description' is a Czech D.M.YYYY date.
    const parts = point.description.replace(/\s/g, "").split(".");
    if (parts.length < 3) continue;
    const [d, m, y] = parts;
    const day = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

    run(
      `INSERT INTO body_metrics (local_date, weight_kg, source, updated_at)
       VALUES (?, ?, 'kaloricke', ?)
       ON CONFLICT(local_date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         source = excluded.source,
         updated_at = excluded.updated_at`,
      day,
      point.value,
      new Date().toISOString(),
    );
  }
}

/**
 * Pulls the last `days` days of diary totals plus bodyweight.
 *
 * Manually-entered days are never overwritten by a KT sync — if you logged a day
 * by hand in the dashboard, that stays authoritative.
 */
export async function syncKaloricke(days = 30): Promise<number> {
  const syncId = startSync("kaloricke");
  try {
    const from = daysAgoLocal(days);
    const to = todayLocal();
    let saved = 0;
    const now = new Date().toISOString();

    for (const day of dayRange(from, to)) {
      const data = await fetchDaySummary(day);

      const values = Object.fromEntries(
        Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
          field,
          findNumber(data, aliases),
        ]),
      ) as Record<string, number | null>;

      tx(() => {
        saveWeights(data);

        const hasAnything = Object.values(values).some((v) => v !== null);
        if (hasAnything) {
          run(
            `INSERT INTO nutrition_days (
               local_date, source, calories_kcal, protein_g, carbs_g, fat_g,
               fiber_g, sugar_g, salt_g, water_ml, updated_at
             ) VALUES (?, 'kaloricke', ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(local_date) DO UPDATE SET
               source        = 'kaloricke',
               calories_kcal = excluded.calories_kcal,
               protein_g     = excluded.protein_g,
               carbs_g       = excluded.carbs_g,
               fat_g         = excluded.fat_g,
               fiber_g       = excluded.fiber_g,
               sugar_g       = excluded.sugar_g,
               salt_g        = excluded.salt_g,
               water_ml      = excluded.water_ml,
               updated_at    = excluded.updated_at
             WHERE nutrition_days.source != 'manual'`,
            day,
            values.calories_kcal,
            values.protein_g,
            values.carbs_g,
            values.fat_g,
            values.fiber_g,
            values.sugar_g,
            values.salt_g,
            values.water_ml,
            now,
          );
          saved++;
        }
      });

      // Be a good citizen against someone else's server.
      await new Promise((r) => setTimeout(r, 350));
    }

    finishSync(syncId, "ok", saved);
    return saved;
  } catch (err) {
    cachedCookies = null;
    finishSync(syncId, "error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
