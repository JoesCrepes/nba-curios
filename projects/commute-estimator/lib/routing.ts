import type { LatLon, RoutedBikeLeg } from './types';
import { decodePolyline } from './polyline';

const BASE = 'https://maps.googleapis.com/maps/api/directions/json';

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  return key;
}

/**
 * Live routed bike-leg distance/time via Google Directions (bicycling mode).
 * Replaces straight-line/haversine estimates with real roads.
 */
export async function getBikeLeg(origin: LatLon, destination: LatLon): Promise<RoutedBikeLeg> {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lon}`,
    destination: `${destination.lat},${destination.lon}`,
    mode: 'bicycling',
    key: apiKey(),
  });

  const res = await fetch(`${BASE}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Google Directions request failed (${res.status})`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(`Google Directions returned ${data.status}: ${data.error_message ?? 'no route'}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  return {
    distanceMeters: leg.distance.value,
    durationMinutes: Math.round(leg.duration.value / 60),
    polyline: decodePolyline(route.overview_polyline.points),
  };
}
