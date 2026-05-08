'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const fromIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#22c55e;width:16px;height:16px;border-radius:50%;
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
    position:relative;
  ">
    <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
      width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #22c55e;"></div>
  </div>`,
  iconSize:   [16, 22],
  iconAnchor: [8, 22],
});

const toIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#ef4444;width:16px;height:16px;border-radius:50%;
    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
    position:relative;
  ">
    <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
      width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #ef4444;"></div>
  </div>`,
  iconSize:   [16, 22],
  iconAnchor: [8, 22],
});

// Delhi center default
const DELHI: [number, number] = [28.6139, 77.2090];

interface Props {
  fromCoords: [number, number] | null;
  toCoords:   [number, number] | null;
  fromName:   string;
  toName:     string;
}

function MapFitter({ fromCoords, toCoords }: { fromCoords: [number,number]|null; toCoords: [number,number]|null }) {
  const map = useMap();
  useEffect(() => {
    if (fromCoords && toCoords) {
      const bounds = L.latLngBounds([fromCoords, toCoords]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else if (fromCoords) {
      map.setView(fromCoords, 14);
    } else if (toCoords) {
      map.setView(toCoords, 14);
    } else {
      map.setView(DELHI, 11);
    }
  }, [fromCoords, toCoords, map]);
  return null;
}

export default function FareMap({ fromCoords, toCoords, fromName, toName }: Props) {
  return (
    <MapContainer
      center={DELHI}
      zoom={11}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapFitter fromCoords={fromCoords} toCoords={toCoords} />

      {fromCoords && (
        <Marker position={fromCoords} icon={fromIcon}>
          <Popup>
            <div className="text-sm font-semibold text-green-700">🟢 From</div>
            <div className="text-xs text-gray-600 mt-0.5">{fromName}</div>
          </Popup>
        </Marker>
      )}

      {toCoords && (
        <Marker position={toCoords} icon={toIcon}>
          <Popup>
            <div className="text-sm font-semibold text-red-600">🔴 To</div>
            <div className="text-xs text-gray-600 mt-0.5">{toName}</div>
          </Popup>
        </Marker>
      )}

      {fromCoords && toCoords && (
        <Polyline
          positions={[fromCoords, toCoords]}
          pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8 6', opacity: 0.8 }}
        />
      )}

      {/* Delhi boundary placeholder when no stops */}
      {!fromCoords && !toCoords && (
        <Marker position={DELHI} icon={L.divIcon({
          className: '',
          html: `<div style="background:#3b82f6;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:0.6;"></div>`,
          iconSize: [12,12], iconAnchor: [6,6],
        })}>
          <Popup><div className="text-xs text-gray-600">Delhi · Select stops to preview route</div></Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
