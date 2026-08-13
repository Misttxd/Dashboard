import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge, Card, Empty, PageHeader, SectionTitle, Table, Td, Tr, buttonVariants } from "@/components/ui";
import { SyncButton } from "@/components/SyncButton";
import { integrationStatuses } from "@/lib/config";
import { all, lastSync } from "@/lib/db";
import type { SyncLogRow } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Providers with a sync endpoint (the coach has nothing to pull). */
const SYNCABLE = new Set(["strava", "hevy", "kaloricke", "trading212"]);

const KEY_SOURCES = [
  {
    name: "Strava",
    href: "https://www.strava.com/settings/api",
    hrefLabel: "strava.com/settings/api",
    body: "Create an app and set the callback domain to localhost, then copy the Client ID and Secret.",
  },
  {
    name: "Hevy",
    href: "https://hevy.com/settings?developer",
    hrefLabel: "hevy.com/settings",
    body: "Requires Hevy Pro. Without it, export a CSV from the app and import it on the Fitness tab — same data, one extra step.",
  },
  {
    name: "Trading 212",
    href: null,
    hrefLabel: null,
    body: "In the app: Settings → API (Beta) → Generate API key. Invest and ISA accounts only. Grant the read scopes; nothing here needs order permissions.",
  },
  {
    name: "Kalorické tabulky",
    href: null,
    hrefLabel: null,
    body: "Your normal login email and password. Unofficial integration — it can break without warning.",
  },
  {
    name: "AI Coach",
    href: "https://console.anthropic.com/settings/keys",
    hrefLabel: "console.anthropic.com",
    body: "Pay-as-you-go API credits, billed to you. Everything else works without it.",
  },
];

export default function SettingsPage() {
  const statuses = integrationStatuses();
  const recent = all<SyncLogRow>("SELECT * FROM sync_log ORDER BY id DESC LIMIT 15");

  return (
    <div className="settle">
      <PageHeader
        title="Settings"
        subtitle="Connections and sync history. Every integration is optional."
      />

      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line">
        {statuses.map((s) => {
          const last = SYNCABLE.has(s.id) ? lastSync(s.id) : undefined;

          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-surface px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                  {s.connected ? (
                    <Badge tone="good">Connected</Badge>
                  ) : s.configured ? (
                    <Badge tone="warn">Needs authorising</Badge>
                  ) : (
                    <Badge>Not configured</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-subtle">{s.detail}</p>
                {last && (
                  <p className="nums mt-1 font-mono text-2xs tabular-nums text-fg-faint">
                    Last sync {last.started_at.slice(0, 16).replace("T", " ")} ·{" "}
                    {last.status === "ok"
                      ? `${last.records} records`
                      : (last.message ?? last.status)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {s.id === "strava" && s.configured && !s.connected && (
                  <a href="/api/strava/authorize" className={buttonVariants.primary}>
                    Connect Strava
                  </a>
                )}
                {s.id === "strava" && s.connected && (
                  <a
                    href="/api/strava/authorize"
                    className={`${buttonVariants.ghost} text-xs`}
                  >
                    Re-authorise
                  </a>
                )}
                {SYNCABLE.has(s.id) && (
                  <SyncButton
                    provider={s.id}
                    disabled={!s.connected}
                    disabledReason={
                      s.id === "hevy" ? "Needs Hevy Pro — use CSV import" : "Not configured"
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Where to get each key</SectionTitle>
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {KEY_SOURCES.map((k) => (
          <div key={k.name} className="bg-surface p-5">
            <h3 className="text-sm font-medium text-fg">{k.name}</h3>
            {k.href && (
              <a
                href={k.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--color-finance)] underline decoration-[color-mix(in_oklab,var(--color-finance)_40%,transparent)] hover:decoration-[var(--color-finance)]"
              >
                {k.hrefLabel}
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{k.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
        All of these go in{" "}
        <code className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
          .env.local
        </code>
        , which is gitignored and never leaves this machine. Restart the dev
        server after editing it.
      </p>

      <SectionTitle>Sync history</SectionTitle>
      <Card bleed>
        {recent.length > 0 ? (
          <Table head={["Provider", "Started", "Status", "Records"]}>
            {recent.map((r) => (
              <Tr key={r.id}>
                <Td align="left" className="font-medium text-fg">
                  {r.provider}
                </Td>
                <Td muted className="text-2xs">
                  {r.started_at.slice(0, 16).replace("T", " ")}
                </Td>
                <Td>
                  {r.status === "ok" ? (
                    <span className="text-[var(--color-pos)]">ok</span>
                  ) : r.status === "running" ? (
                    <span className="text-fg-subtle">running</span>
                  ) : (
                    <span className="text-[var(--color-neg)]" title={r.message ?? undefined}>
                      error
                    </span>
                  )}
                </Td>
                <Td>{r.records}</Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <div className="px-5 pb-5">
            <Empty
              message="No syncs run yet."
              action={
                <Link href="/fitness" className={buttonVariants.secondary}>
                  Import a Hevy CSV to start
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
