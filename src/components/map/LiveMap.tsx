'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BusPosition } from '@/types';
import { timeAgo } from '@/lib/utils';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const busIcon = (delayed: boolean, selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${selected ? '#7c3aed' : delayed ? '#ef4444' : '#1a56db'};
      width:${selected ? 18 : 14}px;
      height:${selected ? 18 : 14}px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:${selected ? '0 0 0 3px rgba(124,58,237,0.4), 0 2px 8px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.4)'};
      ${delayed && !selected ? 'animation: pulse-red 1.5s infinite;' : ''}
    "></div>`,
    iconSize:   [selected ? 18 : 14, selected ? 18 : 14],
    iconAnchor: [selected ? 9 : 7, selected ? 9 : 7],
  });

export interface HeatPoint { lat: number; lng: number; intensity: number; }

interface Props {
  positions:    BusPosition[];
  center?:      [number, number];
  heatPoints?:  HeatPoint[];
  crowdMarkers?: { lat: number; lng: number; count: number; level: string }[];
  selectedBusId?: string;
  onBusClick?:  (pos: BusPosition) => void;
}

function HeatmapOverlay({ heatPoints }: { heatPoints: HeatPoint[] }) {
  const map    = useMap();
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHeat = () => {
      const L2 = (window as any).L;
      if (!L2 || !L2.heatLayer) return;
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
      if (heatPoints.length === 0) return;
      const data = heatPoints.map(p => [p.lat, p.lng, p.intensity]);
      heatRef.current = L2.heatLayer(data, {
        radius: 35, blur: 20, max: 1.0,
        gradient: { 0.0: '#00f', 0.4: '#0ff', 0.65: '#0f0', 0.8: '#ff0', 1.0: '#f00' },
      }).addTo(map);
    };

    if ((window as any).L?.heatLayer) {
      applyHeat();
    } else {
      const existing = document.getElementById('leaflet-heat-script');
      if (!existing) {
        const s = document.createElement('script');
        s.id  = 'leaflet-heat-script';
        s.src = 'https://leaflet.github.io/Leaflet.heat/dist/leaflet-heat.js';
        s.onload = applyHeat;
        document.head.appendChild(s);
      } else {
        existing.addEventListener('load', applyHeat);
      }
    }
    return () => { if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; } };
  }, [map, heatPoints]);

  return null;
}

const CROWD_COLORS: Record<string, string> = {
  low:      '#22c55e',  // green-500
  medium:   '#eab308',  // yellow-500
  high:     '#f97316',  // orange-500
  critical: '#ef4444',  // red-500
};

function CrowdMarkersLayer({ markers }: { markers: { lat: number; lng: number; count: number; level: string }[] }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!markers.length) return;

    const group = L.layerGroup();
    markers.forEach(({ lat, lng, count, level }) => {
      const color = CROWD_COLORS[level] ?? '#94a3b8';
      const radius = Math.max(6, Math.min(22, count / 10));
      const circle = L.circleMarker([lat, lng], {
        radius,
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.55,
      });
      circle.bindPopup(`
        <div style="font-size:12px;min-width:120px">
          <b style="color:${color}">${level.toUpperCase()}</b><br/>
          <span style="color:#374151">${count} pax/hr estimated</span>
        </div>
      `);
      group.addLayer(circle);
    });
    group.addTo(map);
    layerRef.current = group;
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [map, markers]);

  return null;
}

// Pan to selected bus
function FlyToSelected({ positions, selectedBusId }: { positions: BusPosition[]; selectedBusId?: string }) {
  const map = useMap();
  const prev = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedBusId || selectedBusId === prev.current) return;
    const pos = positions.find(p => p.bus === selectedBusId);
    if (pos?.location?.coordinates) {
      const [lng, lat] = pos.location.coordinates;
      if (lat && lng) {
        map.flyTo([lat, lng], 15, { duration: 1.2 });
        prev.current = selectedBusId;
      }
    }
  }, [selectedBusId, positions, map]);

  return null;
}

export default function LiveMap({ positions, center = [28.6139, 77.2090], heatPoints = [], crowdMarkers = [], selectedBusId, onBusClick }: Props) {
  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {heatPoints.length > 0 && <HeatmapOverlay heatPoints={heatPoints} />}
      {crowdMarkers.length > 0 && <CrowdMarkersLayer markers={crowdMarkers} />}
      <FlyToSelected positions={positions} selectedBusId={selectedBusId} />

      {positions.map(pos => {
        if (!pos.location?.coordinates) return null;
        const [lng, lat] = pos.location.coordinates;
        if (!lat || !lng) return null;
        const delayed   = (pos.delay_minutes ?? 0) > 5;
        const selected  = pos.bus === selectedBusId;

        return (
          <Marker
            key={pos.bus}
            position={[lat, lng]}
            icon={busIcon(delayed, selected)}
            eventHandlers={{ click: () => onBusClick?.(pos) }}
          >
            <Popup>
              <div className="text-sm min-w-[160px]">
                <p className="font-semibold mb-1">{(pos as any).busNumber || pos.bus?.slice(-6)}</p>
                <p>Speed: {(pos as any).speed ?? 0} km/h</p>
                <p className={delayed ? 'text-red-600 font-medium' : 'text-green-600'}>
                  Delay: {(pos.delay_minutes ?? 0) > 0 ? `+${pos.delay_minutes} min` : 'On time'}
                </p>
                {(pos as any).nextStage && <p>Next stop: {(pos as any).nextStage.stage_name}</p>}
                <p className="text-gray-400 mt-1">{timeAgo(pos.timestamp)}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
