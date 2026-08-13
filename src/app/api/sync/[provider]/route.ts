import { NextResponse } from "next/server";
import { syncStrava } from "@/lib/integrations/strava";
import { syncHevy } from "@/lib/integrations/hevy";
import { syncKaloricke } from "@/lib/integrations/kaloricke";
import { syncTrading212 } from "@/lib/integrations/trading212";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYNCS: Record<string, () => Promise<number>> = {
  strava: syncStrava,
  hevy: syncHevy,
  kaloricke: () => syncKaloricke(30),
  trading212: syncTrading212,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const sync = SYNCS[provider];

  if (!sync) {
    return NextResponse.json({ error: `Unknown provider "${provider}"` }, { status: 404 });
  }

  try {
    const records = await sync();
    return NextResponse.json({ ok: true, provider, records });
  } catch (err) {
    // The message is already user-facing — each integration throws deliberately
    // worded errors rather than leaking stack traces.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
