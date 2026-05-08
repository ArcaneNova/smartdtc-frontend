'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const stopIcon = (seq: number, isFirst: boolean, isLast: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${isFirst ? '#16a34a' : isLast ? '#dc2626' : '#1a56db'};
      color:white;font-size:9px;font-weight:700;
      width:20px;height:20px;border-radius:50%;border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;
      align-items:center;justify-content:center;">${seq}</div>`,
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
  });

interface Stage {
  _id: string;
  seq: number;
  stage_name: string;
  location: { coordinates: [number, number] };
}

interface BusPosition {
  bus: string;
  busNumber?: string;
  location: { coordinates: [number, number] };
  speed: number;
  delay_minutes: number;
}

interface Props {
  stages:    Stage[];
  liveBuses?: BusPosition[];
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [map, coords]);
  return null;
}

const busIcon = L.divIcon({
  className: '',
  html: `<div style="background:#f59e0b;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6],
});

export default function RouteMap({ stages, liveBuses = [] }: Props) {
  const coords: [number, number][] = stages
    .sort((a, b) => a.seq - b.seq)
    .map((s) => {
      const [lng, lat] = s.location.coordinates;
      return [lat, lng] as [number, number];
    })
    .filter(([lat, lng]) => lat && lng);

  const center: [number, number] = coords.length ? coords[0] : [28.6139, 77.2090];

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {coords.length > 1 && <FitBounds coords={coords} />}

      {/* Route polyline */}
      {coords.length > 1 && (
        <Polyline positions={coords} color="#1a56db" weight={3} opacity={0.7} dashArray="6,4" />
      )}

      {/* Stop markers */}
      {stages.map((s, idx) => {
        const [lng, lat] = s.location.coordinates;
        if (!lat || !lng) return null;
        return (
          <Marker
            key={s._id}
            position={[lat, lng]}
            icon={stopIcon(s.seq, idx === 0, idx === stages.length - 1)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Stop {s.seq}: {s.stage_name}</p>
                <p className="text-gray-400 text-xs">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Live buses on this route */}
      {liveBuses.map((pos) => {
        const [lng, lat] = pos.location.coordinates;
        if (!lat || !lng) return null;
        return (
          <Marker key={pos.bus} position={[lat, lng]} icon={busIcon}>
            <Popup>
              <p className="text-sm font-medium">{pos.busNumber || pos.bus.slice(-6)}</p>
              <p className="text-xs">{pos.speed} km/h · {pos.delay_minutes > 0 ? `+${pos.delay_minutes}m delay` : 'On time'}</p>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
