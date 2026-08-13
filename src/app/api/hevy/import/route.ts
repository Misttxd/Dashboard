import { NextResponse } from "next/server";
import { importHevyCsv } from "@/lib/integrations/hevy";
import { finishSync, startSync } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const csv = await request.text();

  if (!csv.trim()) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const syncId = startSync("hevy-csv");
  try {
    const result = importHevyCsv(csv);
    finishSync(syncId, "ok", result.workouts);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finishSync(syncId, "error", 0, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
