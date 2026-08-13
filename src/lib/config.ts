import "server-only";
import { getToken } from "./db";

/**
 * All secrets live in .env.local (gitignored) and are read only on the server.
 * Nothing here may ever be imported into a client component.
 */

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",

  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
  },
  hevy: {
    apiKey: process.env.HEVY_API_KEY ?? "",
  },
  kaloricke: {
    email: process.env.KT_EMAIL ?? "",
    password: process.env.KT_PASSWORD ?? "",
  },
  trading212: {
    apiKey: process.env.T212_API_KEY ?? "",
    environment: (process.env.T212_ENV === "demo" ? "demo" : "live") as
      | "demo"
      | "live",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
  },
};

export type IntegrationId =
  | "strava"
  | "hevy"
  | "kaloricke"
  | "trading212"
  | "anthropic";

export interface IntegrationStatus {
  id: IntegrationId;
  label: string;
  /** Credentials present in the environment. */
  configured: boolean;
  /** Fully usable right now (for OAuth providers, also means "authorised"). */
  connected: boolean;
  detail: string;
}

export function integrationStatuses(): IntegrationStatus[] {
  const stravaConfigured = Boolean(
    env.strava.clientId && env.strava.clientSecret,
  );
  const stravaToken = stravaConfigured ? getToken("strava") : undefined;

  return [
    {
      id: "strava",
      label: "Strava",
      configured: stravaConfigured,
      connected: Boolean(stravaToken?.refresh_token),
      detail: !stravaConfigured
        ? "Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .env.local"
        : stravaToken?.refresh_token
          ? "Authorised — runs and rides sync automatically"
          : "Credentials found. Click Connect to authorise.",
    },
    {
      id: "hevy",
      label: "Hevy",
      configured: Boolean(env.hevy.apiKey),
      connected: Boolean(env.hevy.apiKey),
      detail: env.hevy.apiKey
        ? "API key found — workouts sync automatically"
        : "No API key (needs Hevy Pro). Use CSV import instead.",
    },
    {
      id: "kaloricke",
      label: "Kalorické tabulky",
      configured: Boolean(env.kaloricke.email && env.kaloricke.password),
      connected: Boolean(env.kaloricke.email && env.kaloricke.password),
      detail: env.kaloricke.email
        ? "Unofficial integration — may break if the site changes"
        : "Add KT_EMAIL and KT_PASSWORD to .env.local, or log food manually",
    },
    {
      id: "trading212",
      label: "Trading 212",
      configured: Boolean(env.trading212.apiKey),
      connected: Boolean(env.trading212.apiKey),
      detail: env.trading212.apiKey
        ? `Read-only, ${env.trading212.environment} environment`
        : "Add T212_API_KEY to .env.local (Settings → API (Beta) in the app)",
    },
    {
      id: "anthropic",
      label: "AI Coach",
      configured: Boolean(env.anthropic.apiKey),
      connected: Boolean(env.anthropic.apiKey),
      detail: env.anthropic.apiKey
        ? `Ready — using ${env.anthropic.model}`
        : "Add ANTHROPIC_API_KEY to .env.local to enable the coach",
    },
  ];
}
