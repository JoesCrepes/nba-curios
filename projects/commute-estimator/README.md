# Commute Estimator

Live door-to-door commute estimates for mixed-mode trips (bike + transit +
bike), combining real-time WMATA data and routed bike-leg times with an LLM
reasoning layer for judgment calls a plain calculator can't make ("shuttle
bus is delayed, bike direct instead").

Ships as an installable PWA (Chrome "Add to Home Screen" on Android). The
backend is a set of Next.js API routes so API keys never reach the browser,
keeping the door open for a later native Android frontend against the same
backend contract without a rewrite.

## Setup

```bash
cd projects/commute-estimator
npm install
cp .env.local.example .env.local
# fill in WMATA_API_KEY, GOOGLE_MAPS_API_KEY, ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, allow location access, and it'll fetch a live
estimate for the default trip.

### Getting API keys

- **WMATA**: free key at https://developer.wmata.com — one key covers Rail
  Predictions, Rail Incidents, and Bus Predictions.
- **Google Maps Platform**: enable the Directions API and billing at
  https://console.cloud.google.com, used server-side only for routed
  bicycling directions.
- **Anthropic**: key at https://console.anthropic.com. The reasoning call
  uses a small/fast model (`claude-haiku-4-5-20251001`) with forced
  structured tool output, so it's one cheap call per estimate.

## How it works

`GET /api/estimate?lat=<>&lon=<>&trip=<id>`:

1. Fetches, in parallel: rail predictions and incidents for the trip's line,
   optional shuttle-bus predictions, and Google-routed bike legs for the
   first mile and every possible alighting-station option.
2. Builds one candidate segment set per alighting station (e.g. Friendship
   Heights vs. Bethesda), each with bike/wait/rail/bike segments.
3. Sends the candidates + incidents + rider preferences to Claude as a
   single structured request; Claude picks the best option and returns a
   summary, reasoning, caveats, and a confidence level.
4. Returns a single `CommuteEstimate` JSON contract (see `lib/types.ts`) —
   this is the stable shape any frontend (this PWA, or a future native app)
   consumes.

If the LLM call fails, the API falls back to the fastest computed option
with `confidence: "low"` rather than failing the whole request.

## Configuring trips

Trips are defined in `lib/config.ts` — not hardcoded to one commute. The
shipped default (`bcc-commute`) is Dupont Circle → Red Line → Friendship
Heights or Bethesda → Bethesda-Chevy Chase High School. Add another entry to
`TRIPS` for a different origin/line/destination; `typicalRailRideMinutes` is
a static approximation since WMATA's live APIs don't expose scheduled
in-vehicle travel time between two stations.

If a rail segment of your trip is currently replaced by a shuttle bus (e.g.
a station closure), set `shuttleBusStopId` on the trip config — find the
stop ID on WMATA's bus schedule pages or via the bus predictions API.

## What's not done yet (v1 scope, per the architecture doc)

- Offline behavior: none — this app needs live data to be useful, so a
  network failure just surfaces as an error state.
- Background location tracking: foreground-only, by design (Section 5 of
  the architecture doc — Android Chrome throttles background geolocation
  too inconsistently to be worth fighting for a bike-commute tool).
- Native Android app: not started (Section 6) — the backend contract is
  already shaped so that's additive work, not a rewrite.
- The trip picker is not exposed in the UI yet; only the default trip in
  `lib/config.ts` is used.
