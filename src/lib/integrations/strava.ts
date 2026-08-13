import "server-only";
import { env } from "../config";
import { finishSync, get, getToken, run, saveToken, startSync, tx } from "../db";
import { dayFromLocalIso } from "../util/date";

const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

/** Read-only scopes: we never post or modify anything on Strava. */
const SCOPE = "read,activity:read_all,profile:read_all";

export function redirectUri(): string {
  return `${env.appUrl}/api/strava/callback`;
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.strava.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
    state,
  });
  return `${AUTH_URL}?${p}`;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.strava.clientId,
      client_secret: env.strava.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token exchange failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as StravaTokenResponse;
  saveToken("strava", {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    scope: SCOPE,
    external_id: data.athlete?.id ? String(data.athlete.id) : null,
  });
}

/**
 * Returns a valid access token, refreshing it if it expires within 60s.
 * Strava access tokens are short-lived (6h); the refresh token is the durable one.
 */
async function accessToken(): Promise<string> {
  const stored = getToken("strava");
  if (!stored?.refresh_token) {
    throw new Error("Strava is not connected. Authorise it from Settings first.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (stored.access_token && stored.expires_at && stored.expires_at > now + 60) {
    return stored.access_token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.strava.clientId,
      client_secret: env.strava.clientSecret,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as StravaTokenResponse;
  saveToken("strava", {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });
  return data.access_token;
}

interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  kilojoules?: number;
  suffer_score?: number;
}

/**
 * Pulls activities newer than the most recent one we already hold.
 *
 * Strava's summary endpoint returns up to 200 per page and is cheap on the rate
 * limit (100 requests / 15 min). On a first run this walks the whole history.
 */
export async function syncStrava(): Promise<number> {
  const syncId = startSync("strava");
  try {
    const token = await accessToken();

    const latest = get<{ start_date: string }>(
      "SELECT start_date FROM activities WHERE source = 'strava' ORDER BY start_date DESC LIMIT 1",
    );
    // Overlap by a day so edits to a recent activity are picked up.
    const after = latest
      ? Math.floor(new Date(latest.start_date).getTime() / 1000) - 86400
      : 0;

    let page = 1;
    let total = 0;

    for (;;) {
      const url = `${API}/athlete/activities?per_page=200&page=${page}${
        after > 0 ? `&after=${after}` : ""
      }`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 429) {
        throw new Error("Strava rate limit hit — try again in 15 minutes.");
      }
      if (!res.ok) {
        throw new Error(`Strava activities failed (${res.status}): ${await res.text()}`);
      }

      const batch = (await res.json()) as StravaActivity[];
      if (batch.length === 0) break;

      tx(() => {
        for (const a of batch) {
          run(
            `INSERT INTO activities (
               id, source, name, sport_type, start_date, local_date, distance_m,
               moving_time_s, elapsed_time_s, elevation_gain_m, average_hr, max_hr,
               average_speed, calories, suffer_score, raw
             ) VALUES (?, 'strava', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               sport_type = excluded.sport_type,
               distance_m = excluded.distance_m,
               moving_time_s = excluded.moving_time_s,
               elapsed_time_s = excluded.elapsed_time_s,
               elevation_gain_m = excluded.elevation_gain_m,
               average_hr = excluded.average_hr,
               max_hr = excluded.max_hr,
               average_speed = excluded.average_speed,
               calories = excluded.calories,
               suffer_score = excluded.suffer_score,
               raw = excluded.raw`,
            String(a.id),
            a.name ?? null,
            a.sport_type ?? a.type ?? null,
            a.start_date,
            dayFromLocalIso(a.start_date_local ?? a.start_date),
            a.distance ?? null,
            a.moving_time ?? null,
            a.elapsed_time ?? null,
            a.total_elevation_gain ?? null,
            a.average_heartrate ?? null,
            a.max_heartrate ?? null,
            a.average_speed ?? null,
            // Summary activities carry kilojoules (bikes) rather than kcal.
            a.kilojoules ?? null,
            a.suffer_score ?? null,
            JSON.stringify(a),
          );
        }
      });

      total += batch.length;
      if (batch.length < 200) break;
      page += 1;
      if (page > 50) break; // hard stop: 10k activities
    }

    finishSync(syncId, "ok", total);
    return total;
  } catch (err) {
    finishSync(syncId, "error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
