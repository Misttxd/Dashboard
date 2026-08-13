/** Date helpers. "Local day" is always a 'YYYY-MM-DD' string in the machine's tz. */

export function toLocalDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return toLocalDay(new Date());
}

export function daysAgoLocal(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDay(d);
}

/**
 * Strava sends `start_date_local` as an ISO string already shifted into the
 * athlete's timezone, so the day is just the first 10 characters — parsing it
 * as a Date would re-apply the local offset and can slip a day.
 */
export function dayFromLocalIso(iso: string): string {
  return iso.slice(0, 10);
}

/** Kalorické tabulky addresses days as Czech-formatted 'D.M.YYYY'. */
export function toCzechDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${Number(d)}.${Number(m)}.${Number(y)}`;
}

/** Inclusive list of local days from `from` to `to`. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cur <= end) {
    out.push(toLocalDay(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
