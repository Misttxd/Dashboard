import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeUrl } from "@/lib/integrations/strava";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Kicks off the Strava OAuth dance. The random `state` is echoed back by Strava
 * and checked in the callback, so a stray request to the callback URL cannot
 * plant someone else's tokens in the database.
 */
export async function GET() {
  if (!env.strava.clientId || !env.strava.clientSecret) {
    return NextResponse.json(
      { error: "STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set in .env.local" },
      { status: 400 },
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));

  res.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
