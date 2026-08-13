import { Card, Empty, PageHeader, SectionTitle, Stat, StatRow, Table, Td, Tr } from "@/components/ui";
import { TrendBars, CHART } from "@/components/charts";
import { HevyImport } from "@/components/HevyImport";
import { SyncButton } from "@/components/SyncButton";
import { ExercisePicker } from "@/components/ExercisePicker";
import {
  recentActivities,
  recentWorkouts,
  sportTotals,
  topExercises,
  weeklyCardio,
  weeklyVolume,
} from "@/lib/queries";
import { integrationStatuses } from "@/lib/config";
import { formatDuration } from "@/lib/util/date";

export const dynamic = "force-dynamic";

export default function FitnessPage() {
  const volume = weeklyVolume(12);
  const cardio = weeklyCardio(12);
  const workouts = recentWorkouts(12);
  const exercises = topExercises(20);
  const sports = sportTotals(90);
  const activities = recentActivities(12);

  const statuses = integrationStatuses();
  const strava = statuses.find((s) => s.id === "strava")!;
  const hevy = statuses.find((s) => s.id === "hevy")!;

  const totalVolume = volume.reduce((sum, w) => sum + (w.volume_kg ?? 0), 0);
  const totalSessions = volume.reduce((sum, w) => sum + (w.workouts ?? 0), 0);
  const totalKm = cardio.reduce((sum, w) => sum + (w.distance_km ?? 0), 0);
  const totalHours = cardio.reduce((sum, w) => sum + (w.hours ?? 0), 0);

  return (
    <div className="settle">
      <PageHeader
        title="Fitness"
        subtitle="Strength from Hevy, cardio from Strava. Everything below covers the last 12 weeks."
        domain="fitness"
        action={
          <div className="flex items-center gap-2">
            <SyncButton
              provider="strava"
              label="Sync Strava"
              disabled={!strava.connected}
              disabledReason={strava.configured ? "Connect in Settings" : "Strava not configured"}
            />
            {hevy.connected && <SyncButton provider="hevy" label="Sync Hevy" />}
          </div>
        }
      />

      <StatRow>
        <Stat label="Sessions" value={totalSessions || null} domain="fitness" hint="12 weeks" />
        <Stat
          label="Volume lifted"
          value={totalVolume ? Math.round(totalVolume / 1000).toLocaleString() : null}
          unit="t"
          domain="fitness"
          hint="12 weeks"
        />
        <Stat
          label="Cardio distance"
          value={totalKm ? Math.round(totalKm) : null}
          unit="km"
          domain="fitness"
          hint="12 weeks"
        />
        <Stat
          label="Cardio time"
          value={totalHours ? Math.round(totalHours) : null}
          unit="h"
          domain="fitness"
          hint="12 weeks"
        />
      </StatRow>

      <Card
        title="Weekly training volume"
        subtitle="Kilograms lifted per week"
        className="mt-4"
        bleed
      >
        <div className="px-2 pb-4">
          {volume.length > 0 ? (
            <TrendBars data={volume} x="week" y="volume_kg" unit=" kg" compact height={280} />
          ) : (
            <div className="px-3">
              <Empty message="Import a Hevy CSV below and this fills in." />
            </div>
          )}
        </div>
      </Card>

      {exercises.length > 0 && (
        <Card
          title="Strength progress"
          subtitle="Estimated one-rep max over time. Epley formula on sets of 12 reps or fewer — an estimate, not a tested max."
          className="mt-4"
        >
          <ExercisePicker
            exercises={exercises.map((e) => ({ key: e.exercise_key, name: e.exercise }))}
          />
        </Card>
      )}

      <Card
        title="Weekly cardio"
        subtitle="Kilometres per week"
        className="mt-4"
        bleed
      >
        <div className="px-2 pb-4">
          {cardio.length > 0 ? (
            <TrendBars
              data={cardio}
              x="week"
              y="distance_km"
              color={CHART.finance}
              unit=" km"
              height={220}
            />
          ) : (
            <div className="px-3">
              <Empty message="Connect Strava in Settings to see your cardio here." />
            </div>
          )}
        </div>
      </Card>

      <SectionTitle>Detail</SectionTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Exercises" subtitle="Ranked by sets logged" bleed>
          {exercises.length > 0 ? (
            <Table head={["Exercise", "Sets", "Best e1RM", "Last"]}>
              {exercises.map((e) => (
                <Tr key={e.exercise_key}>
                  <Td align="left" className="font-medium text-fg">
                    {e.exercise}
                  </Td>
                  <Td>{e.sets}</Td>
                  <Td>{e.best_1rm ? `${e.best_1rm} kg` : "—"}</Td>
                  <Td muted className="text-2xs">
                    {e.last_done}
                  </Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <div className="px-5 pb-5">
              <Empty message="No exercises logged yet." height="sm" />
            </div>
          )}
        </Card>

        <Card title="Cardio by sport" subtitle="Last 90 days" bleed>
          {sports.length > 0 ? (
            <Table head={["Sport", "Count", "Distance", "Time"]}>
              {sports.map((s) => (
                <Tr key={s.sport_type ?? "unknown"}>
                  <Td align="left" className="font-medium text-fg">
                    {s.sport_type ?? "Other"}
                  </Td>
                  <Td>{s.activities}</Td>
                  <Td>{s.distance_km ? `${s.distance_km} km` : "—"}</Td>
                  <Td>{s.hours ? `${s.hours} h` : "—"}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <div className="px-5 pb-5">
              <Empty message="No activities in the last 90 days." height="sm" />
            </div>
          )}
        </Card>

        <Card title="Recent gym sessions" bleed>
          {workouts.length > 0 ? (
            <Table head={["Session", "Exercises", "Sets", "Volume"]}>
              {workouts.map((w) => (
                <Tr key={w.id}>
                  <Td align="left">
                    <div className="font-medium text-fg">{w.title ?? "Workout"}</div>
                    <div className="nums mt-0.5 font-mono text-2xs text-fg-faint tabular-nums">
                      {w.local_date} · {formatDuration(w.duration_s)}
                    </div>
                  </Td>
                  <Td>{w.exercises}</Td>
                  <Td>{w.sets}</Td>
                  <Td>{w.volume_kg ? `${w.volume_kg.toLocaleString()} kg` : "—"}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <div className="px-5 pb-5">
              <Empty message="No workouts yet." height="sm" />
            </div>
          )}
        </Card>

        <Card title="Recent activities" bleed>
          {activities.length > 0 ? (
            <Table head={["Activity", "Distance", "Time", "HR"]}>
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
              <Empty message="No Strava activities yet." height="sm" />
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Import Hevy data"
        subtitle="Hevy app → Settings → Export Data. Re-importing the same file is safe — it updates rather than duplicates."
        className="mt-4"
      >
        <HevyImport />
      </Card>
    </div>
  );
}
