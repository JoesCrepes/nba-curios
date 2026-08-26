import type { LatLon } from './types';

const BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set');
  return key;
}

export type GeocodeResult = {
  formattedAddress: string;
  location: LatLon;
};

/** Resolves a free-text address to coordinates (Geocoding API — enable it on the same key as Directions). */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const params = new URLSearchParams({ address, key: apiKey() });
  const res = await fetch(`${BASE}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Google Geocoding request failed (${res.status})`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Google Geocoding returned ${data.status}: ${data.error_message ?? 'no match'}`);
  }

  const result = data.results[0];
  return {
    formattedAddress: result.formatted_address,
    location: { lat: result.geometry.location.lat, lon: result.geometry.location.lng },
  };
}
