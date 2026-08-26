import type { WmataBusPrediction, WmataIncident, WmataRailPrediction, WmataStation } from './types';

const BASE = 'https://api.wmata.com';

function apiKey(): string {
  const key = process.env.WMATA_API_KEY;
  if (!key) throw new Error('WMATA_API_KEY is not set');
  return key;
}

async function wmataFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { api_key: apiKey() },
    // Predictions/incidents change second-to-second — never cache.
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`WMATA request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Next-train predictions for one or more station codes ("A03,A08" or "All"). */
export async function getRailPredictions(stationCodes: string[]): Promise<WmataRailPrediction[]> {
  const codes = stationCodes.join(',');
  const data = await wmataFetch<{ Trains: WmataRailPrediction[] }>(
    `/StationPrediction.svc/json/GetPrediction/${encodeURIComponent(codes)}`,
  );
  return data.Trains;
}

/** All active system-wide incidents/alerts (structured — no manual web search). */
export async function getIncidents(): Promise<WmataIncident[]> {
  const data = await wmataFetch<{ Incidents: WmataIncident[] }>('/Incidents.svc/json/Incidents');
  return data.Incidents;
}

/** Filter incidents to the lines this trip actually cares about. */
export function incidentsForLine(incidents: WmataIncident[], line: string): WmataIncident[] {
  return incidents.filter((i) => i.LinesAffected.split(';').map((s) => s.trim()).includes(line));
}

// Station list barely ever changes — cache it in-memory for the life of the
// serverless instance instead of hitting WMATA on every planner keystroke.
let stationsCache: { fetchedAt: number; stations: WmataStation[] } | null = null;
const STATIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** All rail stations, optionally filtered to those served by one line code. */
export async function getStations(lineCode?: string): Promise<WmataStation[]> {
  const now = Date.now();
  if (!stationsCache || now - stationsCache.fetchedAt > STATIONS_CACHE_TTL_MS) {
    const data = await wmataFetch<{ Stations: WmataStation[] }>('/Rail.svc/json/jStations');
    stationsCache = { fetchedAt: now, stations: data.Stations };
  }
  if (!lineCode) return stationsCache.stations;
  return stationsCache.stations.filter((s) =>
    [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].includes(lineCode),
  );
}

/** Shuttle-bus ETAs for a given stop ID (used when rail service is replaced by buses). */
export async function getBusPredictions(stopId: string): Promise<WmataBusPrediction[]> {
  const data = await wmataFetch<{ Predictions: WmataBusPrediction[] }>(
    `/NextBusService.svc/json/jPredictions?StopID=${encodeURIComponent(stopId)}`,
  );
  return data.Predictions;
}
