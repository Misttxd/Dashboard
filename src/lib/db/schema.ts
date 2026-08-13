/**
 * Local SQLite schema, applied idempotently on every boot.
 *
 * Kept as a TS string rather than a .sql file so it is bundled with the server
 * build and never depends on the process working directory.
 *
 * Conventions:
 *   - instants  -> ISO-8601 TEXT (UTC)
 *   - local days-> 'YYYY-MM-DD' TEXT
 *   - money/mass-> REAL, always in the unit named by the column suffix
 */
export const SCHEMA_SQL = `
-- ---------------------------------------------------------------------------
-- Plumbing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider      TEXT PRIMARY KEY,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    INTEGER,
  scope         TEXT,
  external_id   TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,
  records     INTEGER NOT NULL DEFAULT 0,
  message     TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_provider ON sync_log(provider, started_at DESC);

-- ---------------------------------------------------------------------------
-- Cardio / Strava
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activities (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL DEFAULT 'strava',
  name             TEXT,
  sport_type       TEXT,
  start_date       TEXT NOT NULL,
  local_date       TEXT NOT NULL,
  distance_m       REAL,
  moving_time_s    INTEGER,
  elapsed_time_s   INTEGER,
  elevation_gain_m REAL,
  average_hr       REAL,
  max_hr           REAL,
  average_speed    REAL,
  calories         REAL,
  suffer_score     REAL,
  raw              TEXT
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(local_date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_sport ON activities(sport_type, local_date DESC);

-- ---------------------------------------------------------------------------
-- Strength / Hevy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workouts (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  title      TEXT,
  start_time TEXT NOT NULL,
  end_time   TEXT,
  local_date TEXT NOT NULL,
  duration_s INTEGER,
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(local_date DESC);

CREATE TABLE IF NOT EXISTS workout_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise     TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  set_index    INTEGER NOT NULL,
  set_type     TEXT,
  weight_kg    REAL,
  reps         INTEGER,
  distance_m   REAL,
  duration_s   INTEGER,
  rpe          REAL,
  volume_kg    REAL,
  est_1rm_kg   REAL,
  UNIQUE (workout_id, exercise_key, set_index)
);

CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_key);
CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nutrition_days (
  local_date    TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  calories_kcal REAL,
  protein_g     REAL,
  carbs_g       REAL,
  fat_g         REAL,
  fiber_g       REAL,
  sugar_g       REAL,
  salt_g        REAL,
  water_ml      REAL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrition_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date    TEXT NOT NULL,
  meal          TEXT,
  name          TEXT NOT NULL,
  amount_g      REAL,
  calories_kcal REAL,
  protein_g     REAL,
  carbs_g       REAL,
  fat_g         REAL,
  source        TEXT NOT NULL,
  external_id   TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON nutrition_entries(local_date DESC);

-- ---------------------------------------------------------------------------
-- Body metrics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS body_metrics (
  local_date   TEXT PRIMARY KEY,
  weight_kg    REAL,
  body_fat_pct REAL,
  source       TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Finance / Trading 212 (read-only mirror)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS instruments (
  ticker     TEXT PRIMARY KEY,
  name       TEXT,
  short_name TEXT,
  type       TEXT,
  currency   TEXT,
  isin       TEXT
);

CREATE TABLE IF NOT EXISTS positions (
  ticker            TEXT PRIMARY KEY,
  quantity          REAL,
  avg_price         REAL,
  current_price     REAL,
  ppl               REAL,
  fx_ppl            REAL,
  initial_fill_date TEXT,
  updated_at        TEXT NOT NULL
);

-- One row per sync. Trading 212 exposes no historical equity curve, so we
-- build our own by snapshotting the account each time we poll.
CREATE TABLE IF NOT EXISTS account_snapshots (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  taken_at TEXT NOT NULL,
  currency TEXT,
  free     REAL,
  total    REAL,
  invested REAL,
  ppl      REAL,
  result   REAL,
  blocked  REAL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_time ON account_snapshots(taken_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id       TEXT PRIMARY KEY,
  type     TEXT,
  amount   REAL,
  currency TEXT,
  date     TEXT,
  raw      TEXT
);

CREATE TABLE IF NOT EXISTS dividends (
  id           TEXT PRIMARY KEY,
  ticker       TEXT,
  amount       REAL,
  gross_amount REAL,
  currency     TEXT,
  paid_on      TEXT,
  raw          TEXT
);

CREATE INDEX IF NOT EXISTS idx_dividends_paid ON dividends(paid_on DESC);

-- ---------------------------------------------------------------------------
-- Goals + AI coach
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  domain       TEXT NOT NULL,
  title        TEXT NOT NULL,
  target_value REAL,
  unit         TEXT,
  target_date  TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  notes        TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_coach_messages ON coach_messages(conversation_id, id);
`;
