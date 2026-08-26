import type { Station } from './types';

// Trips are configurable, not hardcoded to one route (open decision #3 in the
// architecture doc, resolved in favor of generalizing now). A trip is:
//   origin (live geolocation) --bike--> boardingStation --rail--> one of
//   alightingStations --bike--> finalDestination
//
// Multiple alighting stations let the LLM choose between them when an
// incident makes one worse (e.g. Bethesda closed for construction -> use
// Friendship Heights + a longer final bike leg instead).

export type TripConfig = {
  id: string;
  label: string;
  line: string; // WMATA line code: RD, BL, OR, SV, GR, YL
  boardingStation: Station;
  alightingStations: Station[];
  finalDestination: { name: string; location: { lat: number; lon: number } };
  // WMATA's live APIs give next-train ETAs and incidents, but not scheduled
  // in-vehicle travel time between two stations. This is a static, typical
  // scheduled ride time (minutes) per alighting station code — an
  // approximation, surfaced to the LLM/user as such rather than presented
  // as live data.
  typicalRailRideMinutes: Record<string, number>;
  // Populate when a rail segment is currently replaced by a shuttle bus
  // (e.g. the Bethesda station closure). Find current stop IDs at
  // https://www.wmata.com/service/bus/schedule or the bus predictions API's
  // jStopSchedule endpoint. Leave undefined when rail is running normally.
  shuttleBusStopId?: string;
};

// Red Line station codes (verify against WMATA's GetStations endpoint if
// this ever drifts): Dupont Circle A03, Friendship Heights A08, Bethesda A09.
export const TRIPS: TripConfig[] = [
  {
    id: 'bcc-commute',
    label: 'Dupont Circle -> BCC High School',
    line: 'RD',
    boardingStation: {
      code: 'A03',
      name: 'Dupont Circle',
      location: { lat: 38.9097, lon: -77.0434 },
    },
    alightingStations: [
      {
        code: 'A08',
        name: 'Friendship Heights',
        location: { lat: 38.9605, lon: -77.0862 },
      },
      {
        code: 'A09',
        name: 'Bethesda',
        location: { lat: 38.9847, lon: -77.0947 },
      },
    ],
    finalDestination: {
      name: 'Bethesda-Chevy Chase High School',
      location: { lat: 38.9846, lon: -77.0972 },
    },
    // Typical scheduled Red Line ride time from Dupont Circle (approximate).
    typicalRailRideMinutes: {
      A08: 14, // Friendship Heights
      A09: 17, // Bethesda
    },
    // Fill in once the current Bethesda-station shuttle's stop ID is known.
    shuttleBusStopId: undefined,
  },
];

export function getTrip(id: string): TripConfig | undefined {
  return TRIPS.find((t) => t.id === id);
}

export const DEFAULT_TRIP_ID = 'bcc-commute';
