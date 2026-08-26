'use client';

import { useEffect, useState } from 'react';
import styles from './TripPlanner.module.css';
import type { RailStation } from '@/lib/types';
import type { TripConfig } from '@/lib/config';

const LINES = [
  { code: 'RD', name: 'Red' },
  { code: 'BL', name: 'Blue' },
  { code: 'OR', name: 'Orange' },
  { code: 'SV', name: 'Silver' },
  { code: 'GR', name: 'Green' },
  { code: 'YL', name: 'Yellow' },
];

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base || 'trip'}-${Date.now().toString(36)}`;
}

type Props = {
  onSave: (trip: TripConfig) => void;
  onClose: () => void;
};

export default function TripPlanner({ onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [line, setLine] = useState('RD');
  const [stations, setStations] = useState<RailStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [boardingCode, setBoardingCode] = useState('');
  const [alightingCodes, setAlightingCodes] = useState<string[]>([]);

  const [destinationInput, setDestinationInput] = useState('');
  const [destinationResolved, setDestinationResolved] = useState<{
    formattedAddress: string;
    location: { lat: number; lon: number };
  } | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setStations([]);
    setBoardingCode('');
    setAlightingCodes([]);
    setStationsLoading(true);
    setStationsError(null);
    fetch(`/api/stations?line=${encodeURIComponent(line)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load stations');
        return res.json();
      })
      .then((data: RailStation[]) => setStations(data))
      .catch((err) => setStationsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setStationsLoading(false));
  }, [line]);

  async function handleGeocode() {
    if (!destinationInput.trim()) return;
    setGeocodeLoading(true);
    setGeocodeError(null);
    setDestinationResolved(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(destinationInput)}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Geocoding failed');
      setDestinationResolved(await res.json());
    } catch (err) {
      setGeocodeError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeocodeLoading(false);
    }
  }

  function toggleAlighting(code: string) {
    setAlightingCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function handleSave() {
    setSaveError(null);
    const boarding = stations.find((s) => s.code === boardingCode);
    const alighting = stations.filter((s) => alightingCodes.includes(s.code));

    if (!name.trim()) return setSaveError('Give the trip a name.');
    if (!boarding) return setSaveError('Pick a boarding station.');
    if (alighting.length === 0) return setSaveError('Pick at least one alighting station.');
    if (!destinationResolved) return setSaveError('Look up the destination address first.');

    const trip: TripConfig = {
      id: slugify(name),
      label: name.trim(),
      line,
      boardingStation: { code: boarding.code, name: boarding.name, location: boarding.location },
      alightingStations: alighting.map((s) => ({ code: s.code, name: s.name, location: s.location })),
      finalDestination: { name: destinationResolved.formattedAddress, location: destinationResolved.location },
      // No live schedule data for an arbitrary station pair — the backend
      // falls back to a flat 15 min estimate when this is empty.
      typicalRailRideMinutes: {},
    };

    onSave(trip);
  }

  const boardable = stations.filter((s) => s.code !== boardingCode);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2>Plan a new trip</h2>

        <div className={styles.field}>
          <label htmlFor="trip-name">Trip name</label>
          <input
            id="trip-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Home to work"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="trip-line">Rail line</label>
          <select id="trip-line" value={line} onChange={(e) => setLine(e.target.value)}>
            {LINES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {stationsError && <p className={styles.errorText}>{stationsError}</p>}

        <div className={styles.field}>
          <label htmlFor="boarding-station">Boarding station (first bike leg ends here)</label>
          <select
            id="boarding-station"
            value={boardingCode}
            onChange={(e) => {
              setBoardingCode(e.target.value);
              setAlightingCodes((prev) => prev.filter((c) => c !== e.target.value));
            }}
            disabled={stationsLoading || stations.length === 0}
          >
            <option value="">{stationsLoading ? 'Loading stations…' : 'Select a station'}</option>
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label>Alighting station option(s) — pick one or more for the AI to choose between</label>
          <p className={styles.hint}>Add a second option (e.g. an earlier stop) to cover a possible closure.</p>
          <div className={styles.stationList}>
            {boardable.length === 0 && <p className={styles.hint}>Pick a boarding station first.</p>}
            {boardable.map((s) => (
              <label key={s.code} className={styles.stationRow}>
                <input
                  type="checkbox"
                  checked={alightingCodes.includes(s.code)}
                  onChange={() => toggleAlighting(s.code)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="destination">Final destination (second bike leg ends here)</label>
          <div className={styles.addressRow}>
            <input
              id="destination"
              type="text"
              value={destinationInput}
              onChange={(e) => {
                setDestinationInput(e.target.value);
                setDestinationResolved(null);
              }}
              placeholder="Street address, or a place name"
            />
            <button
              type="button"
              className={styles.smallButton}
              onClick={handleGeocode}
              disabled={geocodeLoading || !destinationInput.trim()}
            >
              {geocodeLoading ? '…' : 'Find'}
            </button>
          </div>
          {geocodeError && <p className={styles.errorText}>{geocodeError}</p>}
          {destinationResolved && <p className={styles.resolved}>✓ {destinationResolved.formattedAddress}</p>}
        </div>

        {saveError && <p className={styles.errorText}>{saveError}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.saveButton} onClick={handleSave}>
            Save trip
          </button>
        </div>
      </div>
    </div>
  );
}
