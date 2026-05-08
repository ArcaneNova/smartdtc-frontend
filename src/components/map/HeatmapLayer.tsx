'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1
}

interface HeatmapLayerProps {
  points: HeatPoint[];
}

declare global {
  interface Window {
    L: any;
  }
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    // Dynamically load leaflet.heat
    const script = document.createElement('script');
    script.src = 'https://leaflet.github.io/Leaflet.heat/dist/leaflet-heat.js';
    script.onload = () => {
      if (window.L && window.L.heatLayer) {
        const heatData = points.map((p) => [p.lat, p.lng, p.intensity]);
        const heat = window.L.heatLayer(heatData, {
          radius: 35,
          blur: 20,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.0: '#00f',
            0.4: '#0ff',
            0.65: '#0f0',
            0.8: '#ff0',
            1.0: '#f00',
          },
        });
        heat.addTo(map);

        return () => {
          map.removeLayer(heat);
        };
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [map, points]);

  return null;
}
