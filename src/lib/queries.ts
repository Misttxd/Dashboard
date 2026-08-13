import "server-only";
import { all, get } from "./db";
import { daysAgoLocal, todayLocal } from "./util/date";

/**
 * Every read the UI and the AI coach perform goes through here, so both always
 * see exactly the same numbers.
 */

/* -------------------------------------------------------------------------- */
/* Strength                                                                    */
/* -------------------------------------------------------------------------- */

export interface WorkoutSummary {
  id: string;
  title: string | null;
  local_date: string;
  duration_s: number | null;
  sets: number;
  volume_kg: number | null;
  exercises: number;
}

export function recentWorkouts(limit = 10): WorkoutSummary[] {
  return all<WorkoutSummary>(
    `SELECT w.id, w.title, w.local_date, w.duration_s,
            COUNT(s.id)                     AS sets,
            ROUND(SUM(s.volume_kg))         AS volume_kg,
            COUNT(DISTINCT s.exercise_key)  AS exercises
     FROM workouts w
     LEFT JOIN workout_sets s ON s.workout_id = w.id
     GROUP BY w.id
     ORDER BY w.local_date DESC, w.start_time DESC
     LIMIT ?`,
    limit,
  );
}

export interface WeekVolume {
  week: string;
  volume_kg: number;
  sets: number;
  workouts: number;
}

export function weeklyVolume(weeks = 12): WeekVolume[] {
  return all<WeekVolume>(
    `SELECT strftime('%Y-W%W', w.local_date)  AS week,
            ROUND(COALESCE(SUM(s.volume_kg), 0)) AS volume_kg,
            COUNT(s.id)                       AS sets,
            COUNT(DISTINCT w.id)              AS workouts
     FROM workouts w
     LEFT JOIN workout_sets s ON s.workout_id = w.id
     WHERE w.local_date >= ?
     GROUP BY week
     ORDER BY week`,
    daysAgoLocal(weeks * 7),
  );
}

export interface ExercisePoint {
  local_date: string;
  best_1rm: number | null;
  best_weight: number | null;
  volume_kg: number | null;
}

export function exerciseProgress(exerciseKey: string, limit = 60): ExercisePoint[] {
  return all<ExercisePoint>(
    `SELECT w.local_date,
            MAX(s.est_1rm_kg) AS best_1rm,
            MAX(s.weight_kg)  AS best_weight,
            SUM(s.volume_kg)  AS volume_kg
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_key = ?
     GROUP BY w.local_date
     ORDER BY w.local_date DESC
     LIMIT ?`,
    exerciseKey,
    limit,
  ).reverse();
}

export interface ExerciseSummary {
  exercise_key: string;
  exercise: string;
  sets: number;
  best_1rm: number | null;
  best_weight: number | null;
  last_done: string;
}

export function topExercises(limit = 15): ExerciseSummary[] {
  return all<ExerciseSummary>(
    `SELECT s.exercise_key,
            MAX(s.exercise)   AS exercise,
            COUNT(*)          AS sets,
            MAX(s.est_1rm_kg) AS best_1rm,
            MAX(s.weight_kg)  AS best_weight,
            MAX(w.local_date) AS last_done
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     GROUP BY s.exercise_key
     ORDER BY sets DESC
     LIMIT ?`,
    limit,
  );
}

/* -------------------------------------------------------------------------- */
/* Cardio                                                                      */
/* -------------------------------------------------------------------------- */

export interface ActivityRow {
  id: string;
  name: string | null;
  sport_type: string | null;
  local_date: string;
  distance_m: number | null;
  moving_time_s: number | null;
  average_hr: number | null;
  elevation_gain_m: number | null;
  average_speed: number | null;
}

export function recentActivities(limit = 10): ActivityRow[] {
  return all<ActivityRow>(
    `SELECT id, name, sport_type, local_date, distance_m, moving_time_s,
            average_hr, elevation_gain_m, average_speed
     FROM activities
     ORDER BY local_date DESC, start_date DESC
     LIMIT ?`,
    limit,
  );
}

export interface SportTotal {
  sport_type: string | null;
  activities: number;
  distance_km: number | null;
  hours: number | null;
}

export function sportTotals(days = 90): SportTotal[] {
  return all<SportTotal>(
    `SELECT sport_type,
            COUNT(*)                                AS activities,
            ROUND(SUM(distance_m) / 1000.0, 1)      AS distance_km,
            ROUND(SUM(moving_time_s) / 3600.0, 1)   AS hours
     FROM activities
     WHERE local_date >= ?
     GROUP BY sport_type
     ORDER BY activities DESC`,
    daysAgoLocal(days),
  );
}

export interface WeekCardio {
  week: string;
  distance_km: number;
  hours: number;
  activities: number;
}

export function weeklyCardio(weeks = 12): WeekCardio[] {
  return all<WeekCardio>(
    `SELECT strftime('%Y-W%W', local_date)              AS week,
            ROUND(SUM(distance_m) / 1000.0, 1)          AS distance_km,
            ROUND(SUM(moving_time_s) / 3600.0, 1)       AS hours,
            COUNT(*)                                    AS activities
     FROM activities
     WHERE local_date >= ?
     GROUP BY week
     ORDER BY week`,
    daysAgoLocal(weeks * 7),
  );
}

/* -------------------------------------------------------------------------- */
/* Nutrition + body                                                            */
/* -------------------------------------------------------------------------- */

export interface NutritionDay {
  local_date: string;
  source: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

export function nutritionDays(days = 30): NutritionDay[] {
  return all<NutritionDay>(
    `SELECT local_date, source, calories_kcal, protein_g, carbs_g, fat_g, fiber_g
     FROM nutrition_days
     WHERE local_date >= ?
     ORDER BY local_date`,
    daysAgoLocal(days),
  );
}

export interface NutritionAverages {
  days_logged: number;
  avg_kcal: number | null;
  avg_protein: number | null;
  avg_carbs: number | null;
  avg_fat: number | null;
}

export function nutritionAverages(days = 7): NutritionAverages {
  return (
    get<NutritionAverages>(
      `SELECT COUNT(*)                      AS days_logged,
              ROUND(AVG(calories_kcal))     AS avg_kcal,
              ROUND(AVG(protein_g))         AS avg_protein,
              ROUND(AVG(carbs_g))           AS avg_carbs,
              ROUND(AVG(fat_g))             AS avg_fat
       FROM nutrition_days
       WHERE local_date >= ? AND calories_kcal IS NOT NULL`,
      daysAgoLocal(days),
    ) ?? {
      days_logged: 0,
      avg_kcal: null,
      avg_protein: null,
      avg_carbs: null,
      avg_fat: null,
    }
  );
}

export interface BodyPoint {
  local_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
}

export function bodyweightSeries(days = 180): BodyPoint[] {
  return all<BodyPoint>(
    `SELECT local_date, weight_kg, body_fat_pct
     FROM body_metrics
     WHERE local_date >= ? AND weight_kg IS NOT NULL
     ORDER BY local_date`,
    daysAgoLocal(days),
  );
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                     */
/* -------------------------------------------------------------------------- */

export interface PositionRow {
  ticker: string;
  name: string | null;
  quantity: number | null;
  avg_price: number | null;
  current_price: number | null;
  ppl: number | null;
  value: number | null;
  return_pct: number | null;
  currency: string | null;
}

export function positions(): PositionRow[] {
  return all<PositionRow>(
    `SELECT p.ticker,
            COALESCE(i.name, i.short_name)                AS name,
            p.quantity, p.avg_price, p.current_price, p.ppl,
            ROUND(p.quantity * p.current_price, 2)        AS value,
            CASE WHEN p.avg_price > 0
                 THEN ROUND((p.current_price - p.avg_price) / p.avg_price * 100, 2)
                 ELSE NULL END                            AS return_pct,
            i.currency
     FROM positions p
     LEFT JOIN instruments i ON i.ticker = p.ticker
     ORDER BY value DESC NULLS LAST`,
  );
}

export interface SnapshotPoint {
  taken_at: string;
  total: number | null;
  invested: number | null;
  ppl: number | null;
}

/** One point per day (the last snapshot of each day) to keep the chart clean. */
export function portfolioSeries(days = 180): SnapshotPoint[] {
  return all<SnapshotPoint>(
    `SELECT taken_at, total, invested, ppl
     FROM account_snapshots
     WHERE id IN (
       SELECT MAX(id) FROM account_snapshots GROUP BY substr(taken_at, 1, 10)
     )
     AND substr(taken_at, 1, 10) >= ?
     ORDER BY taken_at`,
    daysAgoLocal(days),
  );
}

export function dividendTotal(): { total: number | null; count: number } {
  return (
    get<{ total: number | null; count: number }>(
      "SELECT ROUND(SUM(amount), 2) AS total, COUNT(*) AS count FROM dividends",
    ) ?? { total: null, count: 0 }
  );
}

/* -------------------------------------------------------------------------- */
/* Goals                                                                       */
/* -------------------------------------------------------------------------- */

export interface Goal {
  id: number;
  domain: string;
  title: string;
  target_value: number | null;
  unit: string | null;
  target_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export function activeGoals(): Goal[] {
  return all<Goal>(
    "SELECT * FROM goals WHERE status = 'active' ORDER BY domain, id",
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export interface Overview {
  workoutsThisWeek: number;
  activitiesThisWeek: number;
  cardioKmThisWeek: number | null;
  avgKcal7d: number | null;
  avgProtein7d: number | null;
  latestWeight: number | null;
  weightChange30d: number | null;
  portfolioTotal: number | null;
  portfolioPpl: number | null;
  currency: string;
}

export function overview(): Overview {
  const weekStart = daysAgoLocal(7);

  const workouts =
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM workouts WHERE local_date >= ?",
      weekStart,
    )?.n ?? 0;

  const cardio = get<{ n: number; km: number | null }>(
    "SELECT COUNT(*) AS n, ROUND(SUM(distance_m) / 1000.0, 1) AS km FROM activities WHERE local_date >= ?",
    weekStart,
  );

  const nutrition = nutritionAverages(7);

  const latest = get<{ weight_kg: number; local_date: string }>(
    "SELECT weight_kg, local_date FROM body_metrics WHERE weight_kg IS NOT NULL ORDER BY local_date DESC LIMIT 1",
  );

  const monthAgo = get<{ weight_kg: number }>(
    `SELECT weight_kg FROM body_metrics
     WHERE weight_kg IS NOT NULL AND local_date <= ?
     ORDER BY local_date DESC LIMIT 1`,
    daysAgoLocal(30),
  );

  const snap = get<{ total: number | null; ppl: number | null; currency: string | null }>(
    "SELECT total, ppl, currency FROM account_snapshots ORDER BY id DESC LIMIT 1",
  );

  return {
    workoutsThisWeek: workouts,
    activitiesThisWeek: cardio?.n ?? 0,
    cardioKmThisWeek: cardio?.km ?? null,
    avgKcal7d: nutrition.avg_kcal,
    avgProtein7d: nutrition.avg_protein,
    latestWeight: latest?.weight_kg ?? null,
    weightChange30d:
      latest && monthAgo
        ? Math.round((latest.weight_kg - monthAgo.weight_kg) * 10) / 10
        : null,
    portfolioTotal: snap?.total ?? null,
    portfolioPpl: snap?.ppl ?? null,
    currency: snap?.currency ?? "EUR",
  };
}

export function hasAnyData(): boolean {
  const n =
    get<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM workouts)
            + (SELECT COUNT(*) FROM activities)
            + (SELECT COUNT(*) FROM nutrition_days)
            + (SELECT COUNT(*) FROM positions) AS n`,
    )?.n ?? 0;
  return n > 0;
}

export { todayLocal };
