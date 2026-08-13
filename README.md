# Personal Dashboard

Training, nutrition and money in one place, with an AI coach that reads the lot.

Runs entirely on your own machine. Your data lives in a local SQLite file
(`data/dashboard.db`) that never leaves the computer — the only outbound traffic
is the API calls to Strava, Hevy, Kalorické tabulky and Trading 212, plus the
coach's calls to Anthropic if you enable it.

## Quick start

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in whatever keys you have (all optional — see the table below), then:

```bash
npm run dev
```

Open http://localhost:3000. Every tab tells you what it still needs.

## Tabs

| Tab | What's in it |
|---|---|
| **Overview** | Last 7 days: sessions, cardio, calories, portfolio value, active goals |
| **Fitness** | Weekly volume, estimated 1RM progress per exercise, cardio by sport, Hevy CSV import |
| **Nutrition** | Calories vs target, macro split, bodyweight trend, manual day logging |
| **Finance** | Holdings, returns, portfolio value over time, dividends |
| **Coach** | Chat that reads your actual numbers before answering |
| **Settings** | Connection status, sync buttons, sync history, where to get each key |

## Integrations

| Service | How it connects | Notes |
|---|---|---|
| **Strava** | OAuth — click *Connect Strava* in Settings | Free. Register an app at [strava.com/settings/api](https://www.strava.com/settings/api) with callback domain `localhost`. Read-only scopes. |
| **Hevy** | API key, or CSV import | The API needs **Hevy Pro**. Without it, export from the app (Settings → Export Data) and drop the CSV on the Fitness tab — same result, just manual. |
| **Kalorické tabulky** | Email + password | ⚠️ **Unofficial.** No public API exists, so this drives the site's own internal endpoints. It can break without warning; if it does, manual entry on the Nutrition tab keeps working. |
| **Trading 212** | API key | App → Settings → API (Beta). **Invest/ISA accounts only** — CFD isn't supported by their API. |
| **AI Coach** | Anthropic API key | Pay-as-you-go. Everything else works without it. |

### Sync behaviour

Syncs are manual — hit the button in Settings or on the relevant tab. Each one
is incremental and safe to re-run; re-importing the same Hevy CSV won't create
duplicates. Days you log by hand are never overwritten by a later
Kalorické tabulky sync.

Trading 212 has no historical portfolio endpoint, so the value-over-time chart
is built from a snapshot taken on each sync. It fills in as you keep syncing.

## The coach

Chat backed by the Anthropic API with **read-only** tools over your local
database — training, cardio, nutrition, bodyweight, portfolio. It cannot write
to the database and cannot reach any third-party account.

On money it will describe what your portfolio has actually done; it will not
tell you what to buy or sell. **No trading endpoint is wired up anywhere in this
codebase** — the Trading 212 client implements read paths only.

Costs run on your own API credits. Set `ANTHROPIC_MODEL` in `.env.local` to use
a cheaper model than the default.

## Security

This repo is public, so:

- Secrets live only in `.env.local`, which is gitignored. `.env.example` is the
  committed template and contains no real values.
- `data/` (your health and financial data) is gitignored.
- Nothing is hardcoded — every credential is read from the environment at runtime.

Before pushing, `git status` should never show `.env.local` or anything under `data/`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Recharts · `node:sqlite`

Storage uses Node 22's built-in `node:sqlite`, so there's no native module to
compile and no build tools required. It prints an experimental-feature warning
on boot; that's expected and harmless.

## Scripts

```bash
npm run dev        # dev server on :3000
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
```
