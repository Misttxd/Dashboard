import { Lock } from "lucide-react";
import {
  Card,
  Delta,
  Empty,
  PageHeader,
  SectionTitle,
  Stat,
  StatRow,
  Table,
  Td,
  Tr,
} from "@/components/ui";
import { TrendArea, CHART } from "@/components/charts";
import { SyncButton } from "@/components/SyncButton";
import { dividendTotal, portfolioSeries, positions } from "@/lib/queries";
import { accountCurrency, latestSnapshot } from "@/lib/integrations/trading212";
import { integrationStatuses } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function FinancePage() {
  const t212 = integrationStatuses().find((s) => s.id === "trading212")!;
  const snap = latestSnapshot();
  const rows = positions();
  const series = portfolioSeries(180);
  const dividends = dividendTotal();
  const currency = accountCurrency();

  const chart = series.map((s) => ({ day: s.taken_at.slice(0, 10), total: s.total }));

  const returnPct =
    snap?.invested && snap.invested > 0 && snap.ppl != null
      ? Math.round((snap.ppl / snap.invested) * 1000) / 10
      : null;

  // Concentration is the thing a holdings table hides: the top position's share.
  const totalValue = rows.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const topShare =
    totalValue > 0 && rows[0]?.value ? Math.round((rows[0].value / totalValue) * 100) : null;

  return (
    <div className="settle">
      <PageHeader
        title="Finance"
        subtitle="Your Trading 212 account, mirrored locally."
        domain="finance"
        action={
          <SyncButton
            provider="trading212"
            label="Sync Trading 212"
            disabled={!t212.connected}
            disabledReason="Add T212_API_KEY"
          />
        }
      />

      <StatRow>
        <Stat
          label="Portfolio value"
          value={snap?.total != null ? snap.total.toFixed(2) : null}
          unit={currency}
          domain="finance"
          hint={
            snap ? `synced ${snap.taken_at.slice(0, 16).replace("T", " ")}` : undefined
          }
        />
        <Stat
          label="Invested"
          value={snap?.invested != null ? snap.invested.toFixed(2) : null}
          unit={currency}
          domain="finance"
        />
        <Stat
          label="Open P/L"
          value={snap?.ppl != null ? Math.abs(snap.ppl).toFixed(2) : null}
          unit={currency}
          domain="finance"
          delta={returnPct}
          deltaUnit="%"
          hint={snap?.ppl != null ? (snap.ppl < 0 ? "down" : "up") : undefined}
        />
        <Stat
          label="Free cash"
          value={snap?.free != null ? snap.free.toFixed(2) : null}
          unit={currency}
          domain="finance"
          hint={
            dividends.count > 0
              ? `${dividends.total} ${currency} dividends`
              : undefined
          }
        />
      </StatRow>

      <Card
        title="Portfolio value"
        subtitle="Built from your own sync history — Trading 212 exposes no historical series, so this starts the day you do"
        className="mt-4"
        bleed
      >
        <div className="px-2 pb-4">
          {chart.length > 1 ? (
            <TrendArea
              data={chart}
              x="day"
              y="total"
              color={CHART.finance}
              unit={` ${currency}`}
              height={300}
              compact
            />
          ) : (
            <div className="px-3">
              <Empty
                message={
                  chart.length === 1
                    ? "One snapshot so far. The curve builds as you keep syncing — one point per day."
                    : "No snapshots yet. Run a sync to take the first one."
                }
              />
            </div>
          )}
        </div>
      </Card>

      <SectionTitle>Holdings</SectionTitle>
      <Card
        subtitle={
          topShare !== null
            ? `${rows.length} positions · largest is ${topShare}% of the portfolio`
            : undefined
        }
        bleed
      >
        {rows.length > 0 ? (
          <Table head={["Position", "Qty", "Avg", "Price", "Value", "Return"]}>
            {rows.map((p) => (
              <Tr key={p.ticker}>
                <Td align="left">
                  <div className="font-medium text-fg">{p.name ?? p.ticker}</div>
                  <div className="mt-0.5 font-mono text-2xs text-fg-faint">{p.ticker}</div>
                </Td>
                <Td>{p.quantity?.toFixed(4).replace(/\.?0+$/, "") ?? "—"}</Td>
                <Td>{p.avg_price?.toFixed(2) ?? "—"}</Td>
                <Td>{p.current_price?.toFixed(2) ?? "—"}</Td>
                <Td className="text-fg">{p.value?.toFixed(2) ?? "—"}</Td>
                <Td>
                  <Delta value={p.return_pct} unit="%" />
                </Td>
              </Tr>
            ))}
          </Table>
        ) : (
          <div className="px-5 pb-5">
            <Empty
              message={
                t212.connected
                  ? "No positions returned. Run a sync — and note the API covers Invest and ISA accounts only, not CFD."
                  : "Add T212_API_KEY to .env.local, then sync."
              }
            />
          </div>
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-fg-subtle">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Read-only by design. No order, transfer or withdrawal endpoint exists
          anywhere in this codebase, and the coach cannot trade.
        </span>
      </p>
    </div>
  );
}
