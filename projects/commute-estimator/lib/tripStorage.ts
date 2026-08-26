'use client';

import type { TripConfig } from './config';

const TRIPS_KEY = 'commute-estimator:custom-trips';
const ACTIVE_TRIP_KEY = 'commute-estimator:active-trip-id';

// Per-viewer convenience only (which trips this browser has built, which one
// is selected) — never anything that needs to be shared or durable, so plain
// localStorage is the right tool rather than a backend store.
export function loadCustomTrips(): TripConfig[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? (JSON.parse(raw) as TripConfig[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTrip(trip: TripConfig): void {
  try {
    const trips = loadCustomTrips().filter((t) => t.id !== trip.id);
    trips.push(trip);
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Best-effort — a private window or full storage just means the trip isn't remembered.
  }
}

export function deleteCustomTrip(id: string): void {
  try {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(loadCustomTrips().filter((t) => t.id !== id)));
  } catch {
    // ignore
  }
}

export function loadActiveTripId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TRIP_KEY);
  } catch {
    return null;
  }
}

export function saveActiveTripId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_TRIP_KEY, id);
  } catch {
    // ignore
  }
}
