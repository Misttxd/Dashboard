# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single user — the owner — running the app privately on their own machine. No
multi-user, no sharing, no audience. Confirmed usage moment: **desktop, evening
review sessions**. Not a phone-first product; not used mid-workout.

The user trains in the gym (strength) and does cardio, tracks food and
bodyweight, and invests. Today those live in four separate apps that don't talk
to each other.

## Product Purpose

Put training, nutrition and money in one place, so the picture can be read
whole rather than reassembled from four apps. Success is that the owner opens
this instead of opening Hevy, Strava, Kalorické tabulky and Trading 212 in turn
— and that the AI coach, seeing all of it at once, can say something none of
those apps could.

Confirmed: **all four jobs matter equally** — checking in on whether things are
on track, logging and syncing data, exploring trends, and talking to the coach.
No single job can be optimised at the others' expense.

## Positioning

The cross-domain view is the mechanism. Any one of the source apps shows its own
slice well; none can relate training load to protein intake to bodyweight trend,
and none has an AI coach with all three in context at once. The coach reading
real synced numbers — not self-reported summaries — is what a single-domain app
cannot copy.

## Operating Context

- Runs locally at `localhost:3000` on the owner's Windows desktop; data in a
  local SQLite file that never leaves the machine.
- Evening sessions at a desktop screen. Dense, information-rich layouts are
  appropriate; touch-target and one-handed constraints are not binding.
- Data arrives by manual sync (a button per integration) rather than
  continuously, so the interface must always convey how fresh the data is and
  what is not yet connected.
- Real-world state is partial and will stay partial: some integrations are
  connected, some are not, and some days are simply unlogged.

## Capabilities and Constraints

Six surfaces: Overview, Fitness, Nutrition, Finance, Coach, Settings.

Data sources and their hard limits:

- **Strava** — official OAuth API, read-only. Cardio activities.
- **Hevy** — official API requires a Pro subscription the owner does not have.
  Strength data therefore arrives by CSV export/import. The API adapter exists
  and activates if a key is ever added.
- **Kalorické tabulky** — no public API exists. The integration drives the
  site's internal endpoints and may break without warning; manual entry is the
  guaranteed path and must always remain first-class, never a fallback
  afterthought.
- **Trading 212** — official API, beta, **read-only by deliberate choice**.
  Invest/ISA accounts only. No order, transfer or withdrawal path is
  implemented anywhere in the codebase. No historical portfolio endpoint
  exists, so the value-over-time series is built from per-sync snapshots and
  starts empty.
- **AI coach** — Anthropic API, optional, billed to the owner's own credits.
  Read-only tools over the local database. Cannot write data and cannot reach
  any third-party account.

Every integration is optional; the app must be fully usable with none of them
configured.

## Brand Commitments

No name, logo or identity beyond the working title "Dashboard".

**Standing visual preference (confirmed):** the owner chose the category
standard — a conventional, well-executed dark analytics dashboard — over four
offered alternative visual worlds. Convention is the commitment here, and it is
to be executed at full craft, without irony or smuggled novelty. Future surfaces
inherit this preference; do not re-run a visual-direction round unless the owner
asks.

**Craft bar (confirmed):** Linear, Vercel/Geist, Stripe Dashboard and
Whoop/Oura, all four. In practice: Linear's spacing rhythm and fast, subtle
motion; Vercel's sharp near-monochrome geometry and precise borders; Stripe's
data density, tables and number formatting; Whoop's fitness-native headline
scores with trend charts as the main event rather than an afterthought.

## Evidence on Hand

Real personal training, nutrition and financial data, synced from the accounts
above into the local database. Nothing is seeded or sampled — an empty database
is the honest first-run state.

There are no testimonials, customers, benchmarks, pricing or case studies, and
none may be invented. There is no logo, brand name or existing identity beyond
the working title "Dashboard".

## Product Principles

1. **The whole picture is the point.** Relationships across domains outrank any
   single domain's completeness.
2. **Partial data is the normal state.** Missing, stale and unconfigured are
   first-class states to be designed for, not error cases to hide.
3. **Never overstate the data.** Estimated 1RM is a formula, Strava calories are
   estimates, a portfolio snapshot is one moment. The interface must not dress
   an estimate as a measurement.
4. **Read-only where it matters.** The app observes money; it never moves it.
   This constraint is a feature and should be legible, not buried.
5. **Honest over flattering.** The coach and the interface both report what the
   numbers say, including when the answer is "you haven't logged anything".

## Accessibility & Inclusion

No user-specific requirement established. Single desktop user, no stated
impairment. Baseline standards still apply — legible contrast on a dark
interface, real focus states, and no meaning carried by colour alone (the four
domain accents must always be reinforced by label or position).
