// Stable contract shared by every frontend (PWA today, native app later).
// Both consume exactly this JSON — see Section 6 of the architecture doc.

export type LatLon = { lat: number; lon: number };

export type Station = {
  code: string; // WMATA station code, e.g. "A03"
  name: string;
  location: LatLon;
};

// Shape returned by GET /api/stations — a Station plus which lines serve it.
export type RailStation = Station & { lines: string[] };

export type SegmentMode = 'bike' | 'rail' | 'bus' | 'wait';

export type Segment = {
  mode: SegmentMode;
  label: string; // "Bike to Dupont Circle", "Red Line to Bethesda"
  fromName: string;
  toName: string;
  estimatedMinutes: number;
  distanceMeters?: number;
  polyline?: LatLon[]; // populated for bike segments from the routing API
  meta?: Record<string, unknown>; // raw supporting data (predictions used, etc.)
};

export type Recommendation = {
  chosenOption: string; // must match one of the candidate option labels passed in
  summary: string;
  reasoning: string;
  caveats: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type DataFreshness = {
  wmataOk: boolean;
  routingOk: boolean;
  llmOk: boolean;
  warnings: string[];
};

export type CommuteEstimate = {
  generatedAt: string;
  origin: LatLon;
  destination: { name: string; location: LatLon };
  segments: Segment[];
  totalMinutes: number;
  recommendation: Recommendation;
  dataFreshness: DataFreshness;
};

// ---- Raw upstream shapes (subset of fields we actually use) ----

export type WmataRailPrediction = {
  Car: string | null;
  Destination: string;
  DestinationCode: string | null;
  DestinationName: string;
  Group: string;
  Line: string;
  LocationCode: string;
  LocationName: string;
  Min: string; // "3", "BRD", "ARR", "---"
};

export type WmataIncident = {
  IncidentID: string;
  Description: string;
  StartLocationFullName: string | null;
  EndLocationFullName: string | null;
  LinesAffected: string; // e.g. "RD;"
  DateUpdated: string;
  IncidentType: string;
};

export type WmataStation = {
  Code: string;
  Name: string;
  Lat: number;
  Lon: number;
  LineCode1: string | null;
  LineCode2: string | null;
  LineCode3: string | null;
  LineCode4: string | null;
};

export type WmataBusPrediction = {
  RouteID: string;
  DirectionText: string;
  Minutes: number;
  VehicleID: string;
};

export type RoutedBikeLeg = {
  distanceMeters: number;
  durationMinutes: number;
  polyline: LatLon[];
};
