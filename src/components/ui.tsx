import type { ReactNode } from "react";

/**
 * Shared presentational primitives. Server-safe: no hooks, no state.
 *
 * Panels separate by hairline seam and one step of elevation — never by shadow
 * or a floating rounded card, and never nested inside one another.
 */

export type Domain = "fitness" | "nutrition" | "finance" | "coach" | "neutral";

const DOMAIN_VAR: Record<Domain, string> = {
  fitness: "var(--color-fitness)",
  nutrition: "var(--color-nutrition)",
  finance: "var(--color-finance)",
  coach: "var(--color-coach)",
  neutral: "var(--color-fg)",
};

/* -------------------------------------------------------------------------- */
/* Page header                                                                 */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
  domain = "neutral",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  domain?: Domain;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {domain !== "neutral" && (
            <span
              aria-hidden="true"
              className="h-4 w-0.5 rounded-full"
              style={{ background: DOMAIN_VAR[domain] }}
            />
          )}
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        </div>
        {subtitle && (
          <p className="mt-2 max-w-prose text-sm text-fg-subtle">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  bleed = false,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Let content run to the panel edge (charts, full-width tables). */
  bleed?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-medium tracking-tight text-fg">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-fg-subtle">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bleed ? "" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Headline reading                                                            */
/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  hint,
  domain = "neutral",
  delta,
  deltaUnit = "",
  goodWhenPositive = true,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  hint?: string;
  domain?: Domain;
  delta?: number | null;
  deltaUnit?: string;
  goodWhenPositive?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";

  return (
    <div className="group relative flex flex-col justify-between gap-3 bg-surface px-5 py-5">
      <div className="flex items-center gap-2">
        {domain !== "neutral" && (
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ background: DOMAIN_VAR[domain] }}
          />
        )}
        <span className="text-xs font-medium tracking-wide text-fg-subtle">
          {label}
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`nums font-mono text-3xl leading-none font-medium tracking-tight tabular-nums ${
              empty ? "text-fg-faint" : "text-fg"
            }`}
          >
            {empty ? "—" : value}
          </span>
          {!empty && unit && (
            <span className="text-sm font-medium text-fg-subtle">{unit}</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta !== undefined && delta !== null && (
            <Delta value={delta} unit={deltaUnit} goodWhenPositive={goodWhenPositive} />
          )}
          {hint && <span className="text-fg-faint">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * A row of readings sharing one ruled band — hairline seams, no nested cards.
 * The 1px gap over a line-coloured ground draws the seams, so they stay exactly
 * one pixel at every breakpoint without per-child border rules.
 */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Signed values                                                               */
/* -------------------------------------------------------------------------- */

export function Delta({
  value,
  unit = "",
  goodWhenPositive = true,
  showSign = true,
}: {
  value: number | null;
  unit?: string;
  goodWhenPositive?: boolean;
  showSign?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className="text-fg-faint">—</span>;
  }

  const neutral = value === 0;
  const good = goodWhenPositive ? value > 0 : value < 0;
  const color = neutral
    ? "text-fg-subtle"
    : good
      ? "text-[var(--color-pos)]"
      : "text-[var(--color-neg)]";

  // The sign carries the meaning; colour only reinforces it.
  const sign = !showSign || neutral ? "" : value > 0 ? "+" : "−";
  const magnitude = Math.abs(value);

  return (
    <span className={`nums font-mono tabular-nums ${color}`}>
      {sign}
      {magnitude}
      {unit}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                       */
/* -------------------------------------------------------------------------- */

export function Table({
  head,
  children,
  align,
}: {
  head: string[];
  children: ReactNode;
  /** Per-column alignment; defaults to left for the first column, right after. */
  align?: ("left" | "right")[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-5 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-fg-subtle ${
                  (align?.[i] ?? (i === 0 ? "left" : "right")) === "left"
                    ? "text-left"
                    : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  align = "right",
  muted = false,
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-5 py-3 ${align === "left" ? "text-left" : "nums text-right font-mono tabular-nums"} ${
        muted ? "text-fg-subtle" : "text-fg-muted"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="transition-colors duration-100 hover:bg-raised/50">{children}</tr>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-line-strong text-fg-subtle",
    good: "border-[color-mix(in_oklab,var(--color-pos)_38%,transparent)] text-[var(--color-pos)]",
    warn: "border-[color-mix(in_oklab,var(--color-warn)_38%,transparent)] text-[var(--color-warn)]",
    bad: "border-[color-mix(in_oklab,var(--color-neg)_38%,transparent)] text-[var(--color-neg)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state — teaches the next action, never just "no data"                 */
/* -------------------------------------------------------------------------- */

export function Empty({
  message,
  action,
  height = "md",
}: {
  message: string;
  action?: ReactNode;
  height?: "sm" | "md" | "lg";
}) {
  const heights = { sm: "py-8", md: "py-14", lg: "py-20" };
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md border border-dashed border-line px-6 text-center ${heights[height]}`}
    >
      <p className="max-w-sm text-sm text-fg-subtle">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons — one vocabulary for the whole app                                  */
/* -------------------------------------------------------------------------- */

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45";

export const buttonVariants = {
  /** Primary sits at maximum contrast rather than taking a colour of its own. */
  primary: `${buttonBase} bg-fg px-3.5 py-2 text-[var(--color-base)] hover:bg-white active:scale-[0.98]`,
  secondary: `${buttonBase} border border-line-strong bg-raised px-3.5 py-2 text-fg hover:border-line-focus hover:bg-overlay active:scale-[0.98]`,
  ghost: `${buttonBase} px-2.5 py-1.5 text-fg-subtle hover:bg-raised hover:text-fg`,
  /** Irreversible actions stay outline until deliberately focused. */
  danger: `${buttonBase} border border-[color-mix(in_oklab,var(--color-neg)_40%,transparent)] px-3.5 py-2 text-[var(--color-neg)] hover:bg-[color-mix(in_oklab,var(--color-neg)_12%,transparent)]`,
};

export const fieldClass =
  "w-full rounded-md border border-line-strong bg-raised px-3 py-2 text-sm text-fg transition-colors duration-150 outline-none placeholder:text-fg-faint hover:border-line-focus focus:border-[var(--color-finance)] disabled:opacity-50";

/* -------------------------------------------------------------------------- */
/* Section label — for grouping inside a page, not a decorative eyebrow        */
/* -------------------------------------------------------------------------- */

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-10 mb-4 text-sm font-medium tracking-tight text-fg">
      {children}
    </h2>
  );
}
