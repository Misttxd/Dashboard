import { Card, Empty, PageHeader, SectionTitle, Stat, StatRow, Table, Td, Tr } from "@/components/ui";
import { MacroBars, TrendArea, TrendLine, Legend, CHART } from "@/components/charts";
import { SyncButton } from "@/components/SyncButton";
import { ManualNutrition } from "@/components/ManualNutrition";
import { bodyweightSeries, nutritionAverages, nutritionDays } from "@/lib/queries";
import { integrationStatuses } from "@/lib/config";
import { getSettingJson } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface Targets {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export default function NutritionPage() {
  const days = nutritionDays(30);
  const avg7 = nutritionAverages(7);
  const avg30 = nutritionAverages(30);
  const weights = bodyweightSeries(180);
  const targets = getSettingJson<Targets>("nutrition:targets", {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });

  const kt = integrationStatuses().find((s) => s.id === "kaloricke")!;

  const chartData = days.map((d) => ({
    day: d.local_date.slice(5),
    kcal: d.calories_kcal,
    protein: d.protein_g ?? 0,
    carbs: d.carbs_g ?? 0,
    fat: d.fat_g ?? 0,
  }));

  const weightData = weights.map((w) => ({ day: w.local_date, weight: w.weight_kg }));
  const latestWeight = weights.at(-1)?.weight_kg ?? null;

  // Trend over the window, not day-to-day noise.
  const weightDelta =
    weights.length > 1 && weights[0].weight_kg != null && latestWeight != null
      ? Math.round((latestWeight - weights[0].weight_kg) * 10) / 10
      : null;

  const kcalDelta =
    avg7.avg_kcal != null && targets.kcal
      ? Math.round(avg7.avg_kcal - targets.kcal)
      : null;

  return (
    <div className="settle">
      <PageHeader
        title="Nutrition"
        subtitle="Calories, macros and bodyweight. Days you enter by hand always win over a sync."
        domain="nutrition"
        action={
          <SyncButton
            provider="kaloricke"
            label="Sync Kalorické tabulky"
            disabled={!kt.connected}
            disabledReason="Add KT_EMAIL / KT_PASSWORD"
          />
        }
      />

      <StatRow>
        <Stat
          label="Avg calories"
          value={avg7.avg_kcal}
          unit="kcal"
          domain="nutrition"
          delta={kcalDelta}
          deltaUnit=" kcal"
          goodWhenPositive={false}
          hint={targets.kcal ? `vs ${targets.kcal} target` : "last 7 days"}
        />
        <Stat
          label="Avg protein"
          value={avg7.avg_protein}
          unit="g"
          domain="nutrition"
          hint={targets.protein ? `target ${targets.protein} g` : "last 7 days"}
        />
        <Stat
          label="Days logged"
          value={`${avg7.days_logged}/7`}
          domain="nutrition"
          hint={`${avg30.days_logged} of last 30`}
        />
        <Stat
          label="Bodyweight"
          value={latestWeight}
          unit="kg"
          domain="nutrition"
          delta={weightDelta}
          deltaUnit=" kg"
          goodWhenPositive={false}
          hint={weights.length > 1 ? "over the window" : undefined}
        />
      </StatRow>

      {!kt.connected && (
        <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-fg-subtle">
          Kalorické tabulky publishes no API. This integration drives the
          website&apos;s own internal endpoints, so it can stop working without
          notice — manual entry below always works regardless.
        </p>
      )}

      <Card
        title="Calories"
        subtitle="Last 30 days, against your target"
        className="mt-4"
        bleed
      >
        <div className="px-2 pb-4">
          {chartData.length > 0 ? (
            <TrendArea
              data={chartData}
              x="day"
              y="kcal"
              color={CHART.nutrition}
              unit=" kcal"
              target={targets.kcal}
              targetLabel={targets.kcal ? "target" : undefined}
              height={280}
            />
          ) : (
            <div className="px-3">
              <Empty message="Nothing logged yet. Sync, or add a day by hand below." />
            </div>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card
          title="Macros"
          subtitle="Grams per day"
          className="lg:col-span-3"
          action={
            <Legend
              items={[
                { label: "Protein", color: CHART.fitness },
                { label: "Carbs", color: CHART.nutrition },
                { label: "Fat", color: CHART.coach },
              ]}
            />
          }
          bleed
        >
          <div className="px-2 pb-4">
            {chartData.length > 0 ? (
              <MacroBars data={chartData} height={240} />
            ) : (
              <div className="px-3">
                <Empty message="No macro data yet." height="sm" />
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Bodyweight"
          subtitle="Last 180 days"
          className="lg:col-span-2"
          bleed
        >
          <div className="px-2 pb-4">
            {weightData.length > 1 ? (
              <TrendLine
                data={weightData}
                x="day"
                y="weight"
                color={CHART.coach}
                unit=" kg"
                height={240}
              />
            ) : (
              <div className="px-3">
                <Empty message="Log your weight below to start the trend." height="sm" />
              </div>
            )}
          </div>
        </Card>
      </div>

      <SectionTitle>Log a day</SectionTitle>
      <Card>
        <ManualNutrition targets={targets} />
      </Card>

      <SectionTitle>Recent days</SectionTitle>
      <Card bleed>
        {days.length > 0 ? (
          <Table head={["Date", "kcal", "Protein", "Carbs", "Fat", "Source"]}>
            {[...days].reverse().map((d) => (
              <Tr key={d.local_date}>
                <Td align="left" className="font-mono text-xs text-fg">
                  {d.local_date}
                </Td>
                <Td>{d.calories_kcal ? Math.round(d.calories_kcal) : "—"}</Td>
                <Td>{d.protein_g ? `${Math.round(d.protein_g)} g` : "—"}</Td>
                <Td>{d.carbs_g ? `${Math.round(d.carbs_g)} g` : "—"}</Td>
                <Td>{d.fat_g ? `${Math.round(d.fat_g)} g` : "—"}</Td>
                <Td muted className="text-2xs">
                  {d.source}
                </Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <div className="px-5 pb-5">
            <Empty message="Nothing logged in the last 30 days." height="sm" />
          </div>
        )}
      </Card>
    </div>
  );
}
