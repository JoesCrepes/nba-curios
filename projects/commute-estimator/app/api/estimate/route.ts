import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_TRIP_ID, getTrip } from '@/lib/config';
import { getBikeLeg } from '@/lib/routing';
import { getRailPredictions, getIncidents, incidentsForLine, getBusPredictions } from '@/lib/wmata';
import { getRecommendation } from '@/lib/anthropic';
import type { CommuteEstimate, Segment, WmataIncident } from '@/lib/types';

export const dynamic = 'force-dynamic';

function bestWaitMinutes(minField: string): number | null {
  if (minField === 'ARR') return 0;
  if (minField === 'BRD') return 0;
  const n = Number(minField);
  return Number.isFinite(n) ? n : null;
}

// Logs the real error server-side but only ever surfaces a clean,
// user-facing sentence to the response — raw error text (env var names,
// upstream status codes) has no business reaching the UI.
function warn(warnings: string[], userMessage: string, err: unknown): void {
  console.error(userMessage, err);
  warnings.push(userMessage);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const tripId = searchParams.get('trip') ?? DEFAULT_TRIP_ID;

  if (latParam === null || lonParam === null) {
    return NextResponse.json({ error: 'lat and lon query params are required' }, { status: 400 });
  }
  const lat = Number(latParam);
  const lon = Number(lonParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon must be numbers' }, { status: 400 });
  }

  const trip = getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: `Unknown trip id: ${tripId}` }, { status: 404 });
  }

  const origin = { lat, lon };
  const warnings: string[] = [];
  let wmataOk = true;
  let routingOk = true;

  const [firstBikeLegResult, ...alightingBikeLegResults] = await Promise.allSettled([
    getBikeLeg(origin, trip.boardingStation.location),
    ...trip.alightingStations.map((s) => getBikeLeg(s.location, trip.finalDestination.location)),
  ]);

  const [railPredictionsResult, incidentsResult, busResult] = await Promise.allSettled([
    getRailPredictions([trip.boardingStation.code, ...trip.alightingStations.map((s) => s.code)]),
    getIncidents(),
    trip.shuttleBusStopId ? getBusPredictions(trip.shuttleBusStopId) : Promise.resolve(null),
  ]);

  if (firstBikeLegResult.status === 'rejected') {
    routingOk = false;
    warn(warnings, 'Live bike routing unavailable — distance/time may be inaccurate.', firstBikeLegResult.reason);
  }
  const firstBikeLeg = firstBikeLegResult.status === 'fulfilled' ? firstBikeLegResult.value : null;

  const railPredictions = railPredictionsResult.status === 'fulfilled' ? railPredictionsResult.value : [];
  if (railPredictionsResult.status === 'rejected') {
    wmataOk = false;
    warn(warnings, 'Live train predictions unavailable — using a conservative wait estimate.', railPredictionsResult.reason);
  }

  const allIncidents: WmataIncident[] = incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];
  if (incidentsResult.status === 'rejected') {
    wmataOk = false;
    warn(warnings, 'Live service alerts unavailable.', incidentsResult.reason);
  }
  const lineIncidents = incidentsForLine(allIncidents, trip.line);

  const busPredictions = busResult.status === 'fulfilled' ? busResult.value : null;
  if (busResult.status === 'rejected') {
    warn(warnings, 'Live shuttle bus predictions unavailable.', busResult.reason);
  }

  // Build one candidate segment set per alighting station option.
  const candidateSegmentSets = trip.alightingStations.map((station, i) => {
    const bikeLegResult = alightingBikeLegResults[i];
    const bikeLeg = bikeLegResult.status === 'fulfilled' ? bikeLegResult.value : null;
    if (bikeLegResult.status === 'rejected') {
      routingOk = false;
      warn(warnings, `Live bike routing to ${station.name} unavailable — distance/time may be inaccurate.`, bikeLegResult.reason);
    }

    const boardingPredictions = railPredictions.filter(
      (p) => p.LocationCode === trip.boardingStation.code && p.Line === trip.line,
    );
    const waitCandidates = boardingPredictions.map((p) => bestWaitMinutes(p.Min)).filter((m): m is number => m !== null);
    const waitMinutes = waitCandidates.length ? Math.min(...waitCandidates) : null;

    const segments: Segment[] = [];

    segments.push({
      mode: 'bike',
      label: `Bike to ${trip.boardingStation.name}`,
      fromName: 'Current location',
      toName: trip.boardingStation.name,
      estimatedMinutes: firstBikeLeg?.durationMinutes ?? 0,
      distanceMeters: firstBikeLeg?.distanceMeters,
      polyline: firstBikeLeg?.polyline,
    });

    segments.push({
      mode: 'wait',
      label: `Wait for ${trip.line} Line train`,
      fromName: trip.boardingStation.name,
      toName: trip.boardingStation.name,
      estimatedMinutes: waitMinutes ?? 8, // conservative default when no live prediction
      meta: { livePredictionAvailable: waitMinutes !== null, rawPredictions: boardingPredictions },
    });

    segments.push({
      mode: 'rail',
      label: `${trip.line} Line to ${station.name}`,
      fromName: trip.boardingStation.name,
      toName: station.name,
      estimatedMinutes: trip.typicalRailRideMinutes[station.code] ?? 15,
      meta: { source: 'typical-schedule-not-live' },
    });

    segments.push({
      mode: 'bike',
      label: `Bike to ${trip.finalDestination.name}`,
      fromName: station.name,
      toName: trip.finalDestination.name,
      estimatedMinutes: bikeLeg?.durationMinutes ?? 0,
      distanceMeters: bikeLeg?.distanceMeters,
      polyline: bikeLeg?.polyline,
    });

    return {
      label: `Via ${station.name}`,
      segments,
      totalMinutes: segments.reduce((sum, s) => sum + s.estimatedMinutes, 0),
    };
  });

  if (busPredictions) {
    warnings.push(`Shuttle bus active for this trip: ${busPredictions.length} prediction(s) available.`);
  }

  let recommendation;
  let llmOk = true;
  try {
    recommendation = await getRecommendation({
      candidateSegmentSets,
      incidents: lineIncidents,
      preferences: { bikeOverWalk: true, pace: 'casual' },
      dataWarnings: warnings,
    });
  } catch (err) {
    llmOk = false;
    warn(warnings, 'AI recommendation unavailable — showing the fastest computed option.', err);
    const fastest = [...candidateSegmentSets].sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
    recommendation = {
      chosenOption: fastest.label,
      summary: fastest.label,
      reasoning: 'LLM reasoning was unavailable; showing the fastest computed option.',
      caveats: warnings,
      confidence: 'low' as const,
    };
  }

  const chosen =
    candidateSegmentSets.find((c) => c.label === recommendation.chosenOption) ??
    [...candidateSegmentSets].sort((a, b) => a.totalMinutes - b.totalMinutes)[0];

  const estimate: CommuteEstimate = {
    generatedAt: new Date().toISOString(),
    origin,
    destination: { name: trip.finalDestination.name, location: trip.finalDestination.location },
    segments: chosen.segments,
    totalMinutes: chosen.totalMinutes,
    recommendation,
    dataFreshness: { wmataOk, routingOk, llmOk, warnings },
  };

  return NextResponse.json(estimate);
}
