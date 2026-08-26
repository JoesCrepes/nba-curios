import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/geocode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const address = new URL(req.url).searchParams.get('address');
  if (!address || !address.trim()) {
    return NextResponse.json({ error: 'address query param is required' }, { status: 400 });
  }

  try {
    const result = await geocodeAddress(address);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Geocoding failed', err);
    return NextResponse.json({ error: `Could not find a location for "${address}".` }, { status: 502 });
  }
}
