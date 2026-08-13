import "server-only";
import { env } from "../config";
import { finishSync, get, run, startSync, tx } from "../db";
import { dayFromLocalIso, toLocalDay } from "../util/date";

/**
 * Two ways in, one shape out.
 *
 *  - CSV import  — works on a free Hevy account (Settings → Export Data).
 *  - REST API    — needs Hevy Pro; enabled automatically once HEVY_API_KEY is set.
 *
 * Both funnel into `upsertWorkout` so the rest of the app never cares which
 * produced a given row.
 */

const API = "https://api.hevyapp.com/v1";

export interface NormalisedSet {
  exercise: string;
  setIndex: number;
  setType: string | null;
  weightKg: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  rpe: number | null;
}

export interface NormalisedWorkout {
  id: string;
  source: string;
  title: string | null;
  startTime: string;
  endTime: string | null;
  durationS: number | null;
  notes: string | null;
  sets: NormalisedSet[];
}

export function exerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Epley. Meaningless above ~12 reps, so we don't compute it there. */
function estimate1rm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 12) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function upsertWorkout(w: NormalisedWorkout): void {
  run(
    `INSERT INTO workouts (id, source, title, start_time, end_time, local_date, duration_s, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, end_time = excluded.end_time,
       duration_s = excluded.duration_s, notes = excluded.notes`,
    w.id,
    w.source,
    w.title,
    w.startTime,
    w.endTime,
    dayFromLocalIso(w.startTime),
    w.durationS,
    w.notes,
  );

  // Replace sets wholesale: a re-import is the source of truth for that workout.
  run("DELETE FROM workout_sets WHERE workout_id = ?", w.id);

  for (const s of w.sets) {
    const volume = s.weightKg && s.reps ? s.weightKg * s.reps : null;
    run(
      `INSERT INTO workout_sets (
         workout_id, exercise, exercise_key, set_index, set_type,
         weight_kg, reps, distance_m, duration_s, rpe, volume_kg, est_1rm_kg
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workout_id, exercise_key, set_index) DO NOTHING`,
      w.id,
      s.exercise,
      exerciseKey(s.exercise),
      s.setIndex,
      s.setType,
      s.weightKg,
      s.reps,
      s.distanceM,
      s.durationS,
      s.rpe,
      volume,
      estimate1rm(s.weightKg, s.reps),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* CSV import                                                                  */
/* -------------------------------------------------------------------------- */

/** RFC-4180 parser: handles quoted fields, embedded commas and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Hevy's export has one row per set. Column names have changed across app
 * versions, so each field is looked up through a list of known aliases rather
 * than a fixed index.
 */
const COLUMNS: Record<string, string[]> = {
  title: ["title", "workout_name"],
  start: ["start_time", "date", "workout_date"],
  end: ["end_time"],
  description: ["description", "workout_notes"],
  exercise: ["exercise_title", "exercise_name", "exercise"],
  setIndex: ["set_index", "set_order", "set_number"],
  setType: ["set_type"],
  weight: ["weight_kg", "weight", "weight_lbs"],
  reps: ["reps", "repetitions"],
  distance: ["distance_km", "distance_m", "distance_miles", "distance"],
  duration: ["duration_seconds", "duration_s", "seconds", "duration"],
  rpe: ["rpe"],
  notes: ["notes", "set_notes"],
};

function indexOfColumn(header: string[], field: string): number {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const alias of COLUMNS[field] ?? []) {
    const i = norm.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Hevy timestamps look like "12 Aug 2026, 18:30" or ISO. Date.parse handles
 * both; anything it rejects we skip rather than silently storing epoch 0.
 */
function parseHevyDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const cleaned = t.replace(/(\d{4}),/, "$1");
  const ms = Date.parse(cleaned);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toLocalDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface ImportResult {
  workouts: number;
  sets: number;
  skippedRows: number;
  warnings: string[];
}

export function importHevyCsv(csv: string): ImportResult {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("CSV appears to be empty.");

  const header = rows[0];
  const col = Object.fromEntries(
    Object.keys(COLUMNS).map((f) => [f, indexOfColumn(header, f)]),
  ) as Record<keyof typeof COLUMNS, number>;

  if (col.start === -1 || col.exercise === -1) {
    throw new Error(
      `Could not recognise this as a Hevy export. Columns found: ${header.join(", ")}`,
    );
  }

  const warnings: string[] = [];
  if (col.weight !== -1 && /lbs/i.test(header[col.weight])) {
    warnings.push("Weights were in lbs and have been converted to kg.");
  }
  const lbsToKg = col.weight !== -1 && /lbs/i.test(header[col.weight]);
  const distanceUnit =
    col.distance !== -1 ? header[col.distance].toLowerCase() : "";

  const byWorkout = new Map<string, NormalisedWorkout>();
  let skipped = 0;
  let setCount = 0;

  for (const r of rows.slice(1)) {
    const startRaw = r[col.start] ?? "";
    const start = parseHevyDate(startRaw);
    const exercise = (r[col.exercise] ?? "").trim();

    if (!start || !exercise) {
      skipped++;
      continue;
    }

    const title = col.title !== -1 ? (r[col.title] ?? "").trim() : "";
    // Hevy has no workout id in the CSV: title+start uniquely identifies one.
    const id = `hevy-csv:${start}:${title}`;

    let w = byWorkout.get(id);
    if (!w) {
      w = {
        id,
        source: "hevy-csv",
        title: title || null,
        startTime: start,
        endTime: col.end !== -1 ? parseHevyDate(r[col.end] ?? "") : null,
        durationS: null,
        notes: col.description !== -1 ? (r[col.description] ?? "").trim() || null : null,
        sets: [],
      };
      byWorkout.set(id, w);
    }

    let weight = col.weight !== -1 ? num(r[col.weight]) : null;
    if (weight !== null && lbsToKg) weight = Math.round(weight * 0.45359237 * 100) / 100;

    let distance = col.distance !== -1 ? num(r[col.distance]) : null;
    if (distance !== null) {
      if (distanceUnit.includes("km")) distance *= 1000;
      else if (distanceUnit.includes("mile")) distance *= 1609.344;
    }

    w.sets.push({
      exercise,
      setIndex: col.setIndex !== -1 ? (num(r[col.setIndex]) ?? w.sets.length) : w.sets.length,
      setType: col.setType !== -1 ? (r[col.setType] ?? "").trim() || null : null,
      weightKg: weight,
      reps: col.reps !== -1 ? num(r[col.reps]) : null,
      distanceM: distance,
      durationS: col.duration !== -1 ? num(r[col.duration]) : null,
      rpe: col.rpe !== -1 ? num(r[col.rpe]) : null,
    });
    setCount++;
  }

  tx(() => {
    for (const w of byWorkout.values()) {
      if (w.endTime) {
        const ms = Date.parse(w.endTime) - Date.parse(w.startTime);
        if (ms > 0) w.durationS = Math.round(ms / 1000);
      }
      upsertWorkout(w);
    }
  });

  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (unparseable date or exercise).`);

  return { workouts: byWorkout.size, sets: setCount, skippedRows: skipped, warnings };
}

/* -------------------------------------------------------------------------- */
/* REST API (Hevy Pro)                                                         */
/* -------------------------------------------------------------------------- */

interface HevyApiSet {
  index?: number;
  type?: string;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
}

interface HevyApiExercise {
  title: string;
  notes?: string | null;
  sets?: HevyApiSet[];
}

interface HevyApiWorkout {
  id: string;
  title?: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  exercises?: HevyApiExercise[];
}

export function hevyApiAvailable(): boolean {
  return Boolean(env.hevy.apiKey);
}

export async function syncHevy(): Promise<number> {
  if (!hevyApiAvailable()) {
    throw new Error(
      "No Hevy API key. Hevy's API requires a Pro subscription — import a CSV export instead.",
    );
  }

  const syncId = startSync("hevy");
  try {
    let page = 1;
    let total = 0;

    for (;;) {
      const res = await fetch(`${API}/workouts?page=${page}&pageSize=10`, {
        headers: { "api-key": env.hevy.apiKey, Accept: "application/json" },
      });

      if (res.status === 401) throw new Error("Hevy rejected the API key (401).");
      if (!res.ok) throw new Error(`Hevy API failed (${res.status}): ${await res.text()}`);

      const body = (await res.json()) as {
        workouts?: HevyApiWorkout[];
        page_count?: number;
      };
      const workouts = body.workouts ?? [];
      if (workouts.length === 0) break;

      tx(() => {
        for (const w of workouts) {
          const sets: NormalisedSet[] = [];
          let i = 0;
          for (const ex of w.exercises ?? []) {
            for (const s of ex.sets ?? []) {
              sets.push({
                exercise: ex.title,
                setIndex: s.index ?? i,
                setType: s.type ?? null,
                weightKg: s.weight_kg ?? null,
                reps: s.reps ?? null,
                distanceM: s.distance_meters ?? null,
                durationS: s.duration_seconds ?? null,
                rpe: s.rpe ?? null,
              });
              i++;
            }
          }

          const durationS = w.end_time
            ? Math.round((Date.parse(w.end_time) - Date.parse(w.start_time)) / 1000)
            : null;

          upsertWorkout({
            id: `hevy:${w.id}`,
            source: "hevy-api",
            title: w.title ?? null,
            startTime: w.start_time,
            endTime: w.end_time ?? null,
            durationS: durationS && durationS > 0 ? durationS : null,
            notes: w.description ?? null,
            sets,
          });
        }
      });

      total += workouts.length;
      if (body.page_count !== undefined && page >= body.page_count) break;
      page += 1;
      if (page > 200) break;
    }

    finishSync(syncId, "ok", total);
    return total;
  } catch (err) {
    finishSync(syncId, "error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/** Latest workout date we hold, for the Settings page. */
export function lastWorkoutDate(): string | undefined {
  return get<{ local_date: string }>(
    "SELECT local_date FROM workouts ORDER BY local_date DESC LIMIT 1",
  )?.local_date;
}
