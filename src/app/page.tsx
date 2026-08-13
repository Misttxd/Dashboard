import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Stat,
  StatRow,
  Table,
  Td,
  Tr,
  buttonVariants,
} from "@/components/ui";
import { TrendBars, TrendLine, CHART } from "@/components/charts";
import {
  activeGoals,
  bodyweightSeries,
  hasAnyData,
  overview,
  recentActivities,
  recentWorkouts,
  weeklyVolume,
} from "@/lib/queries";
import { formatDuration } from "@/lib/util/date";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const seeded = hasAnyData();

  if (!seeded) return <FirstRun />;

  const o = overview();
  const workouts = recentWorkouts(6);
  const activities = recentActivities(5);
  const volume = weeklyVolume(12);
  const weights = bodyweightSeries(90);
  const goals = activeGoals();

  const weightData = weights.map((w) => ({ day: w.local_date, weight: w.weight_kg }));

  return (
    <div className="settle">
      <PageHeader
        title="Overview"
        subtitle="How the last seven days came together across training, food and money."
      />

      <StatRow>
        <Stat
          label="Gym sessions"
          value={o.workoutsThisWeek}
          domain="fitness"
          hint="last 7 days"
        />
        <Stat
          label="Cardio"
          value={o.cardioKmThisWeek}
          unit="km"
          domain="fitness"
          hint={`${o.activitiesThisWeek} ${o.activitiesThisWeek === 1 ? "activity" : "activities"}`}
        />
        <Stat
          label="Avg calories"
          value={o.avgKcal7d}
          unit="kcal"
          domain="nutrition"
          hint={o.avgProtein7d ? `${o.avgProtein7d} g protein` : "nothing logged"}
        />
        <Stat
          label="Portfolio"
          value={o.portfolioTotal !== null ? o.portfolioTotal.toFixed(2) : null}
          unit={o.currency}
          domain="finance"
          delta={o.portfolioPpl !== null ? Math.round(o.portfolioPpl * 100) / 100 : null}
          deltaUnit={` ${o.currency}`}
          hint={o.portfolioPpl !== null ? "open P/L" : undefined}
        />
      </StatRow>

      {goals.length > 0 && (
        <Card title="Active goals" className="mt-4">
          <ul className="divide-y divide-line">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-fg-muted">{g.title}</span>
                <span className="nums shrink-0 font-mono text-xs tabular-nums text-fg-subtle">
                  {g.target_value !== null && `${g.target_value} ${g.unit ?? ""}`}
                  {g.target_date && ` · by ${g.target_date}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* The trend is the main event: full width, before any table. */}
      <Card
        title="Training volume"
        subtitle="Total kilograms lifted per week, last 12 weeks"
        className="mt-4"
        bleed
      >
        <div className="px-2 pb-4">
          {volume.length > 0 ? (
            <TrendBars data={volume} x="week" y="volume_kg" unit=" kg" compact height={280} />
          ) : (
            <div className="px-3">
              <Empty
                message="No gym data yet. Export your workouts from Hevy and import the CSV on the Fitness tab."
                action={
                  <Link href="/fitness" className={buttonVariants.secondary}>
                    Go to Fitness <ArrowRight size={14} />
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card
          title="Bodyweight"
          subtitle="Last 90 days"
          className="lg:col-span-2"
          bleed
        >
          <div className="px-2 pb-4">
            {weightData.length > 1 ? (
              <TrendLine
                data={weightData}
                x="day"
                y="weight"
                color={CHART.nutrition}
                unit=" kg"
                height={220}
              />
            ) : (
              <div className="px-3">
                <Empty message="Log your weight on the Nutrition tab to see the trend." height="sm" />
              </div>
            )}
          </div>
        </Card>

        <Card title="Recent gym sessions" className="lg:col-span-3" bleed>
          {workouts.length > 0 ? (
            <Table head={["Session", "Sets", "Volume"]}>
              {workouts.map((w) => (
                <Tr key={w.id}>
                  <Td align="left">
                    <div className="font-medium text-fg">{w.title ?? "Workout"}</div>
                    <div className="nums mt-0.5 font-mono text-2xs text-fg-faint tabular-nums">
                      {w.local_date} · {formatDuration(w.duration_s)}
                    </div>
                  </Td>
                  <Td>{w.sets}</Td>
                  <Td>{w.volume_kg ? `${w.volume_kg.toLocaleString()} kg` : "—"}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <div className="px-5 pb-5">
              <Empty message="No workouts imported yet." height="sm" />
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Recent activities"
        subtitle="From Strava"
        className="mt-4"
        bleed
      >
        {activities.length > 0 ? (
          <Table head={["Activity", "Distance", "Time", "Avg HR"]}>
            {activities.map((a) => (
              <Tr key={a.id}>
                <Td align="left">
                  <div className="font-medium text-fg">{a.name ?? "Activity"}</div>
                  <div className="nums mt-0.5 font-mono text-2xs text-fg-faint tabular-nums">
                    {a.local_date} · {a.sport_type ?? "—"}
                  </div>
                </Td>
                <Td>{a.distance_m ? `${(a.distance_m / 1000).toFixed(2)} km` : "—"}</Td>
                <Td>{formatDuration(a.moving_time_s)}</Td>
                <Td>{a.average_hr ? Math.round(a.average_hr) : "—"}</Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <div className="px-5 pb-5">
            <Empty
              message="Strava isn't connected yet, so there's no cardio here."
              action={
                <Link href="/settings" className={buttonVariants.secondary}>
                  Connect Strava <ArrowRight size={14} />
                </Link>
              }
              height="sm"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    title: "Add your keys",
    body: (
      <>
        Copy <Code>.env.example</Code> to <Code>.env.local</Code> and fill in
        whatever you have. Every integration is optional.
      </>
    ),
  },
  {
    title: "Connect and sync",
    body: (
      <>
        Open Settings, authorise Strava, then run each sync. Syncs are manual and
        safe to re-run.
      </>
    ),
  },
  {
    title: "Import your lifting",
    body: (
      <>
        Export from Hevy (Settings → Export Data) and drop the CSV on the Fitness
        tab. Re-importing the same file won't duplicate anything.
      </>
    ),
  },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-xs text-fg-muted">
      {children}
    </code>
  );
}

function FirstRun() {
  return (
    <div className="settle">
      <PageHeader
        title="Overview"
        subtitle="Nothing has been synced yet. Three steps and this fills up."
        action={<Badge tone="warn">No data</Badge>}
      />

      <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-surface p-5">
            <span className="nums font-mono text-xs tabular-nums text-fg-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-3 text-sm font-medium text-fg">{s.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-subtle">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/settings" className={buttonVariants.primary}>
          Open Settings <ArrowRight size={14} />
        </Link>
        <Link href="/fitness" className={buttonVariants.secondary}>
          Import Hevy CSV
        </Link>
      </div>
    </div>
  );
}
