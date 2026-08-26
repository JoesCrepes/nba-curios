'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLon, Segment } from '@/lib/types';

// Leaflet's default marker icons reference image paths that break under
// bundlers; point them at the CDN copies instead of wiring up asset imports.
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const liveIcon = L.divIcon({
  className: 'live-position-marker',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const segmentColors: Record<Segment['mode'], string> = {
  bike: '#22c55e',
  rail: '#ef4444',
  bus: '#f59e0b',
  wait: '#64748b',
};

function Recenter({ position }: { position: LatLon }) {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lon], map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

type MapProps = {
  livePosition: LatLon;
  segments: Segment[];
  destination: { name: string; location: LatLon };
};

export default function Map({ livePosition, segments, destination }: MapProps) {
  return (
    <MapContainer
      center={[livePosition.lat, livePosition.lon]}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter position={livePosition} />

      <Marker position={[livePosition.lat, livePosition.lon]} icon={liveIcon}>
        <Popup>You are here</Popup>
      </Marker>

      <Marker position={[destination.location.lat, destination.location.lon]}>
        <Popup>{destination.name}</Popup>
      </Marker>

      {segments
        .filter((s) => s.polyline && s.polyline.length > 1)
        .map((s, i) => (
          <Polyline
            key={i}
            positions={s.polyline!.map((p) => [p.lat, p.lon])}
            pathOptions={{ color: segmentColors[s.mode], weight: 5, opacity: 0.8 }}
          />
        ))}
    </MapContainer>
  );
}
