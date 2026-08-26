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
- **Google Maps Platform**: enable both the **Directions API** (routed
  bicycling legs) and the **Geocoding API** (resolving a typed address in the
  trip planner) plus billing at https://console.cloud.google.com. Both are
  used server-side only, on the same key. If the key returns
  `REQUEST_DENIED: The provided API key is invalid`, check that the key's
  **API restrictions** include the APIs above, and that its **application
  restrictions** aren't set to "HTTP referrers" — that only works for
  browser calls, and this key is only ever called from the server.
- **Anthropic**: key at https://console.anthropic.com. The reasoning call
  uses a small/fast model (`claude-haiku-4-5-20251001`) with forced
  structured tool output, so it's one cheap call per estimate.

## How it works

`POST /api/estimate` with `{ origin: {lat, lon}, trip }` (or `{ origin, tripId }`
for one of the built-in trips in `lib/config.ts`):

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
with `confidence: "low"` rather than failing the whole request. A `GET`
variant (`?lat=&lon=&trip=<id>`, built-in trips only) still exists for quick
manual testing.

Two supporting endpoints back the trip planner UI:
- `GET /api/stations?line=<RD|BL|OR|SV|GR|YL>` — WMATA's live station list
  for that line (code, name, coordinates), cached in-memory for 24h since it
  rarely changes.
- `GET /api/geocode?address=<text>` — resolves a typed address to coordinates
  via Google Geocoding.

## Configuring trips

A trip is boarding station → one or more alighting-station options → final
destination, on one WMATA line — not hardcoded to one commute. Two ways to
define one:

- **In the UI**: tap "+ New trip", pick a line, pick a boarding station and
  one or more alighting stations from WMATA's live station list, and type a
  destination address to geocode. Saved trips live in the browser's
  `localStorage` (per-device, not synced) and are POSTed to `/api/estimate`
  as a full trip object — the backend never stores them.
- **In code**: add an entry to `TRIPS` in `lib/config.ts`, the same shape the
  planner builds. The shipped default (`bcc-commute`) is Dupont Circle → Red
  Line → Friendship Heights or Bethesda → Bethesda-Chevy Chase High School.
  A code-defined trip can also set `typicalRailRideMinutes`, a static
  approximation of in-vehicle ride time per alighting station — WMATA's live
  APIs don't expose that, so trips built in the UI default to none and the
  backend falls back to a flat 15 min estimate; trips in `lib/config.ts` can
  supply a more accurate number per station pair.

If a rail segment of your trip is currently replaced by a shuttle bus (e.g.
a station closure), set `shuttleBusStopId` on the trip config — find the
stop ID on WMATA's bus schedule pages or via the bus predictions API. This
is only available for code-defined trips today, not from the planner UI.

## What's not done yet (v1 scope, per the architecture doc)

- Offline behavior: none — this app needs live data to be useful, so a
  network failure just surfaces as an error state.
- Background location tracking: foreground-only, by design (Section 5 of
  the architecture doc — Android Chrome throttles background geolocation
  too inconsistently to be worth fighting for a bike-commute tool).
- Native Android app: not started (Section 6) — the backend contract is
  already shaped so that's additive work, not a rewrite.
- Trips built in the planner UI don't support a shuttle-bus stop ID, and
  aren't shared across devices (they're `localStorage`-only).
