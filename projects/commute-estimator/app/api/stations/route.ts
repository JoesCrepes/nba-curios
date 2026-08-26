import { NextRequest, NextResponse } from 'next/server';
import { getStations } from '@/lib/wmata';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const line = new URL(req.url).searchParams.get('line') ?? undefined;

  try {
    const stations = await getStations(line);
    return NextResponse.json(
      stations
        .map((s) => ({
          code: s.Code,
          name: s.Name,
          location: { lat: s.Lat, lon: s.Lon },
          lines: [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].filter(
            (l): l is string => l !== null,
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  } catch (err) {
    console.error('Failed to fetch WMATA stations', err);
    return NextResponse.json(
      { error: 'Station list unavailable — check that WMATA_API_KEY is set.' },
      { status: 503 },
    );
  }
}
