import { NextResponse, type NextRequest } from "next/server";
import { exerciseProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing ?key" }, { status: 400 });
  }
  return NextResponse.json({ points: exerciseProgress(key) });
}
