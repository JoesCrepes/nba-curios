import type { WmataBusPrediction, WmataIncident, WmataRailPrediction } from './types';

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

/** Shuttle-bus ETAs for a given stop ID (used when rail service is replaced by buses). */
export async function getBusPredictions(stopId: string): Promise<WmataBusPrediction[]> {
  const data = await wmataFetch<{ Predictions: WmataBusPrediction[] }>(
    `/NextBusService.svc/json/jPredictions?StopID=${encodeURIComponent(stopId)}`,
  );
  return data.Predictions;
}
