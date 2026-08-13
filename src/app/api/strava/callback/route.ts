import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/integrations/strava";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

function back(message: string, ok = false) {
  const url = new URL("/settings", env.appUrl);
  url.searchParams.set(ok ? "connected" : "error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const error = params.get("error");
  if (error) return back(`Strava returned "${error}"`);

  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get("strava_oauth_state")?.value;

  if (!code) return back("No authorisation code returned");
  if (!state || !expected || state !== expected) {
    return back("OAuth state mismatch — start the connection again from Settings");
  }

  // Strava lists granted scopes here; without activity:read we would sync nothing.
  const scope = params.get("scope") ?? "";
  if (!scope.includes("activity:read")) {
    return back("Activity read permission was not granted");
  }

  try {
    await exchangeCode(code);
  } catch (err) {
    return back(err instanceof Error ? err.message : "Token exchange failed");
  }

  const res = back("strava", true);
  res.cookies.delete("strava_oauth_state");
  return res;
}
