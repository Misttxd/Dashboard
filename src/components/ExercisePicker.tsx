"use client";

import { useEffect, useState } from "react";
import { TrendLine } from "./charts";
import { Delta, fieldClass } from "./ui";

interface Point {
  local_date: string;
  best_1rm: number | null;
  best_weight: number | null;
}

/**
 * Flip between exercises without a page navigation. The series is fetched on
 * demand rather than shipping every exercise's history up front.
 */
export function ExercisePicker({
  exercises,
}: {
  exercises: { key: string; name: string }[];
}) {
  const [selected, setSelected] = useState(exercises[0]?.key ?? "");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    setLoading(true);
    setFailed(false);
    fetch(`/api/exercise?key=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d: { points?: Point[] }) => {
        if (!cancelled) setPoints(d.points ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const usable = points.filter((p) => p.best_1rm !== null);
  const first = usable[0]?.best_1rm ?? null;
  const last = usable.at(-1)?.best_1rm ?? null;
  const change =
    first != null && last != null ? Math.round((last - first) * 10) / 10 : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5">
          <span className="sr-only">Exercise</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={`${fieldClass} w-auto min-w-56 cursor-pointer pr-8`}
          >
            {exercises.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        {!loading && usable.length > 1 && (
          <div className="flex items-baseline gap-2.5">
            <span className="nums font-mono text-2xl font-medium tabular-nums text-fg">
              {last}
              <span className="ml-1 text-sm font-normal text-fg-subtle">kg</span>
            </span>
            <Delta value={change} unit=" kg" />
            <span className="text-xs text-fg-faint">over {usable.length} sessions</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="skeleton h-[240px] w-full" aria-label="Loading exercise history" />
      ) : failed ? (
        <p role="alert" className="py-20 text-center text-sm text-[var(--color-neg)]">
          Couldn&apos;t load this exercise. Try selecting it again.
        </p>
      ) : usable.length > 1 ? (
        <TrendLine data={usable} x="local_date" y="best_1rm" unit=" kg" height={240} />
      ) : (
        <p className="py-20 text-center text-sm text-fg-subtle">
          Not enough data for this exercise yet — it needs at least two sessions
          with sets of 12 reps or fewer.
        </p>
      )}
    </div>
  );
}
