'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.css';
import type { CommuteEstimate, LatLon, Segment } from '@/lib/types';
import { DEFAULT_TRIP_ID } from '@/lib/config';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const segmentColors: Record<Segment['mode'], string> = {
  bike: '#22c55e',
  rail: '#ef4444',
  bus: '#f59e0b',
  wait: '#64748b',
};

export default function Page() {
  const [position, setPosition] = useState<LatLon | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<CommuteEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);

  // Live position for the map marker — free, client-side, no backend call.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchEstimate = useCallback(async (pos: LatLon) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        lat: String(pos.lat),
        lon: String(pos.lon),
        trip: DEFAULT_TRIP_ID,
      });
      const res = await fetch(`/api/estimate?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setEstimate(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch a real estimate once, as soon as we know where we are — not on
  // every watchPosition update, since each estimate costs live API calls.
  useEffect(() => {
    if (position && !hasFetchedOnce.current) {
      hasFetchedOnce.current = true;
      fetchEstimate(position);
    }
  }, [position, fetchEstimate]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Commute Estimator</h1>
        <button
          className={styles.refreshButton}
          disabled={!position || loading}
          onClick={() => position && fetchEstimate(position)}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className={styles.mapWrap}>
        {position ? (
          <Map
            livePosition={position}
            segments={estimate?.segments ?? []}
            destination={
              estimate?.destination ?? {
                name: 'Destination',
                location: position,
              }
            }
          />
        ) : (
          <div className={styles.status}>
            {geoError ? <span className={styles.error}>{geoError}</span> : 'Waiting for your location…'}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}

        {!estimate && !error && position && (
          <p className={styles.status}>{loading ? 'Estimating your commute…' : 'No estimate yet.'}</p>
        )}

        {estimate && (
          <>
            <div className={styles.recommendation}>
              <span className={styles.confidence}>{estimate.recommendation.confidence} confidence</span>
              <h2>{estimate.recommendation.summary}</h2>
              <p className={styles.reasoning}>{estimate.recommendation.reasoning}</p>
              {estimate.recommendation.caveats.length > 0 && (
                <ul className={styles.caveats}>
                  {estimate.recommendation.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </div>

            <ul className={styles.segmentList}>
              {estimate.segments.map((s, i) => (
                <li key={i} className={styles.segmentRow}>
                  <span className={styles.segmentDot} style={{ background: segmentColors[s.mode] }} />
                  <span className={styles.segmentLabel}>{s.label}</span>
                  <span className={styles.segmentMinutes}>{s.estimatedMinutes} min</span>
                </li>
              ))}
            </ul>

            <p className={styles.total}>Total: {estimate.totalMinutes} min</p>
          </>
        )}
      </div>
    </div>
  );
}
