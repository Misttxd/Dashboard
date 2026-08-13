"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Charts are the main event on this dashboard, not a garnish beside the tables.
 * One grammar throughout: horizontal rules only, no axis lines, no dots until
 * you hover, ticks tinted from the palette rather than left grey.
 *
 * Recharts hands most colours to SVG as *presentation attributes*, where a
 * `var()` reference does not resolve — so the SVG-bound values below are
 * literals mirroring the tokens in globals.css. Anything that lands in a real
 * style object (the tooltip) keeps using the variables. Keep the two in step.
 */
export const CHART = {
  line: "#1d1f24",
  tick: "#7b818a",
  faint: "#565c65",
  base: "#08090a",
  fitness: "#2dd4bf",
  nutrition: "#f5b544",
  finance: "#7c8cff",
  coach: "#b083f0",
  pos: "#3fcf8e",
} as const;

const TICK = { fill: CHART.tick, fontSize: 11 };
const MARGIN = { top: 8, right: 6, bottom: 0, left: 0 };

interface SeriesProps {
  /** `object[]` rather than `Record<string, unknown>[]` so plain interfaces from
   *  the query layer are assignable without a cast at every call site. */
  data: object[];
  x: string;
  y: string;
  color?: string;
  height?: number;
  unit?: string;
  /** Dashed horizontal target line, e.g. a calorie goal. */
  target?: number | null;
  targetLabel?: string;
  /** Compact axis numbers: 16438 -> 16k */
  compact?: boolean;
}

function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(v);
}

function tooltip(unit: string) {
  return {
    contentStyle: {
      backgroundColor: "var(--color-overlay)",
      border: "1px solid var(--color-line-strong)",
      borderRadius: "0.5rem",
      boxShadow: "var(--shadow-pop)",
      fontSize: "0.75rem",
      padding: "0.5rem 0.75rem",
    },
    labelStyle: {
      color: "var(--color-fg-subtle)",
      fontSize: "0.6875rem",
      marginBottom: "0.25rem",
    },
    itemStyle: { color: "var(--color-fg)", padding: 0 },
    formatter: (v: number | string) => [`${v}${unit}`, ""] as [string, string],
  };
}

/**
 * The axis/target helpers below are *called* (`{XA({...})}`) rather than
 * rendered (`<XA />`). Recharts introspects its children by component type to
 * build the chart, so a wrapper component would be invisible to it; calling
 * the helper hands Recharts the real <XAxis> element it expects.
 */
function XA({ dataKey, gap = 28 }: { dataKey: string; gap?: number }) {
  return (
    <XAxis
      dataKey={dataKey}
      tick={TICK}
      tickLine={false}
      axisLine={false}
      tickMargin={10}
      minTickGap={gap}
    />
  );
}

function YA({ compact, width = 52 }: { compact?: boolean; width?: number }) {
  return (
    <YAxis
      tick={TICK}
      tickLine={false}
      axisLine={false}
      width={width}
      tickMargin={8}
      domain={["auto", "auto"]}
      tickFormatter={compact ? (v: number) => compactNumber(v) : undefined}
    />
  );
}

function Target({ value, label }: { value: number | null | undefined; label?: string }) {
  if (value == null) return null;
  return (
    <ReferenceLine
      y={value}
      stroke={CHART.faint}
      strokeDasharray="3 3"
      label={
        label
          ? {
              value: label,
              position: "insideTopRight",
              fill: CHART.faint,
              fontSize: 10,
            }
          : undefined
      }
    />
  );
}

const activeDot = (color: string) => ({
  r: 3.5,
  fill: color,
  stroke: CHART.base,
  strokeWidth: 2,
});

/* -------------------------------------------------------------------------- */

export function TrendArea({
  data,
  x,
  y,
  color = CHART.finance,
  height = 260,
  unit = "",
  target = null,
  targetLabel,
  compact = false,
}: SeriesProps) {
  const gradientId = `ga-${y}-${color.replace(/\W/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={MARGIN}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        {XA({ dataKey: x })}
        {YA({ compact })}
        <Tooltip {...tooltip(unit)} cursor={{ stroke: CHART.faint, strokeWidth: 1 }} />
        {Target({ value: target, label: targetLabel })}
        <Area
          type="monotone"
          dataKey={y}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={activeDot(color)}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
  x,
  y,
  color = CHART.fitness,
  height = 240,
  unit = "",
  target = null,
  targetLabel,
  compact = false,
}: SeriesProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        {XA({ dataKey: x })}
        {YA({ compact })}
        <Tooltip {...tooltip(unit)} cursor={{ stroke: CHART.faint, strokeWidth: 1 }} />
        {Target({ value: target, label: targetLabel })}
        <Line
          type="monotone"
          dataKey={y}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={activeDot(color)}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrendBars({
  data,
  x,
  y,
  color = CHART.fitness,
  height = 260,
  unit = "",
  target = null,
  compact = false,
}: SeriesProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        {XA({ dataKey: x, gap: 12 })}
        {YA({ compact })}
        <Tooltip
          {...tooltip(unit)}
          cursor={{ fill: "rgba(255,255,255,0.045)" }}
        />
        {Target({ value: target })}
        <Bar dataKey={y} fill={color} radius={[2, 2, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked macro grams per day. Pair with <Legend> — hue alone never identifies. */
export function MacroBars({ data, height = 260 }: { data: object[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        {XA({ dataKey: "day", gap: 12 })}
        {YA({ width: 44 })}
        <Tooltip
          contentStyle={tooltip("").contentStyle}
          labelStyle={tooltip("").labelStyle}
          itemStyle={{ color: "var(--color-fg)", padding: 0 }}
          formatter={(v: number | string, name: string) =>
            [`${v} g`, name] as [string, string]
          }
          cursor={{ fill: "rgba(255,255,255,0.045)" }}
        />
        <Bar dataKey="protein" name="Protein" stackId="m" fill={CHART.fitness} maxBarSize={30} />
        <Bar dataKey="carbs" name="Carbs" stackId="m" fill={CHART.nutrition} maxBarSize={30} />
        <Bar
          dataKey="fat"
          name="Fat"
          stackId="m"
          fill={CHART.coach}
          radius={[2, 2, 0, 0]}
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Small colour key, so a series is never identified by hue alone. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <span
            aria-hidden="true"
            className="size-2 rounded-[2px]"
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
