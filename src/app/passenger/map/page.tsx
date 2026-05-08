'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import type { BusPosition } from '@/types';
import {
  Bell, X, Navigation, Zap, Clock, RefreshCw, MapPin,
  Bus, CheckCircle, AlertTriangle, Filter, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });
const AI_URL  = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

interface AlarmEntry { busId: string; busNumber?: string; radius: number; triggered: boolean; }
interface ETAResult  { etaMinutes: number; congestionLevel: string; }

export default function PassengerMap() {
  const [positions,    setPositions]    = useState<BusPosition[]>([]);
  const [selected,     setSelected]     = useState<BusPosition | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [eta,          setEta]          = useState<ETAResult | null>(null);
  const [etaLoading,   setEtaLoading]   = useState(false);
  const [alarms,       setAlarms]       = useState<AlarmEntry[]>([]);
  const [showAlarms,   setShowAlarms]   = useState(false);
  const [locAlarm,     setLocAlarm]     = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [userLoc,      setUserLoc]      = useState<{ lat: number; lng: number } | null>(null);
  const [routeFilter,  setRouteFilter]  = useState('');
  const [showPanel,    setShowPanel]    = useState(false);
  const [heatPoints,   setHeatPoints]   = useState<any[]>([]);
  const [showHeatmap,  setShowHeatmap]  = useState(false);

  // GPS
  useEffect(() => {
    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(p => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserLoc(pos);
        // Check location alarm
        if (locAlarm) {
          const d = Math.sqrt((pos.lat - locAlarm.lat) ** 2 + (pos.lng - locAlarm.lng) ** 2) * 111000;
          if (d <= locAlarm.radius) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('📍 You have arrived!', { body: 'You are near your destination.' });
            }
            toast.success('📍 You have arrived at your destination!');
            setLocAlarm(null);
          }
        }
      }, () => {}, { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(id);
    }
  }, [locAlarm]);

  const fetchBuses = useCallback(async () => {
    try {
      const { data } = await api.get('/tracking/live');
      setPositions((data.positions || []).filter((p: any) => !p.isSimulated));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBuses();
    const socket = connectSocket();
    socket.on('bus:location_update', (pos: BusPosition) => {
      if ((pos as any).isSimulated) return;
      setPositions(prev => {
        const idx = prev.findIndex(p => p.bus === pos.bus);
        const next = idx >= 0 ? [...prev] : [pos, ...prev];
        if (idx >= 0) next[idx] = { ...next[idx], ...pos };
        return next;
      });
      setSelected(curr => curr && curr.bus === pos.bus ? { ...curr, ...pos } : curr);

      // Check bus alarms
      setAlarms(prev => prev.map(alarm => {
        if (alarm.busId === pos.bus && !alarm.triggered) {
          const userLat = userLoc?.lat ?? 0;
          const userLng = userLoc?.lng ?? 0;
          const [bLng, bLat] = pos.location?.coordinates || [0, 0];
          const d = Math.sqrt((bLat - userLat) ** 2 + (bLng - userLng) ** 2) * 111;
          if (d <= alarm.radius / 1000) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`🚌 Bus ${alarm.busNumber ?? ''} is nearby!`, { body: `Only ${(d * 1000).toFixed(0)}m away.` });
            }
            toast.success(`🚌 Bus ${alarm.busNumber ?? alarm.busId.slice(-4)} is ${(d * 1000).toFixed(0)}m from you!`);
            return { ...alarm, triggered: true };
          }
        }
        return alarm;
      }));
    });
    return () => { socket.off('bus:location_update'); };
  }, [fetchBuses, userLoc]);

  const fetchETA = useCallback(async (pos: BusPosition) => {
    setEtaLoading(true); setEta(null);
    try {
      const res = await fetch(`${AI_URL}/predict/eta`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_km:     (pos as any).distanceToNextStop ?? 2,
          hour:            new Date().getHours(),
          day_of_week:     new Date().getDay(),
          current_speed:   (pos as any).speed ?? 25,
          stops_remaining: (pos as any).stopsRemaining ?? 4,
        }),
      });
      const d = await res.json();
      setEta({ etaMinutes: d.predicted_eta_minutes ?? d.eta_minutes ?? 5, congestionLevel: d.congestion_level ?? 'Low' });
    } catch {
      setEta({ etaMinutes: Math.round(((pos as any).distanceToNextStop ?? 2) / Math.max((pos as any).speed ?? 20, 5) * 60), congestionLevel: 'Unknown' });
    }
    setEtaLoading(false);
  }, []);

  const handleSelectBus = (pos: BusPosition) => { setSelected(pos); fetchETA(pos); setShowPanel(true); };

  const addBusAlarm = (busId: string, busNumber?: string) => {
    if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
    setAlarms(prev => {
      if (prev.find(a => a.busId === busId)) return prev;
      return [...prev, { busId, busNumber, radius: 500, triggered: false }];
    });
    toast.success(`🔔 Alarm set for bus ${busNumber ?? busId.slice(-4)}!`);
  };

  const fetchHeatmap = async () => {
    try {
      const h = new Date().getHours();
      const date = new Date().toISOString().split('T')[0];
      const { data } = await api.get(`/demand/heatmap?date=${date}&hour=${h}`);
      setHeatPoints((data.heatmap || []).map((d: any) => ({
        lat: d.lat, lng: d.lng,
        intensity: Math.min(1, (d.predictedCount || 50) / 200),
      })));
    } catch {}
  };

  const filtered = routeFilter ? positions.filter(p => (p as any).routeId === routeFilter || (p as any).route === routeFilter) : positions;

  const congestionColor: Record<string, string> = {
    Low: 'text-green-600', Medium: 'text-yellow-600', High: 'text-red-600', Unknown: 'text-gray-500',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] relative">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex gap-2">
        <div className="flex-1 bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-lg flex items-center px-3 py-2 gap-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">{filtered.length} buses live</span>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto" />
        </div>
        <button
          onClick={() => { setShowHeatmap(v => !v); if (!showHeatmap) fetchHeatmap(); }}
          className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors ${showHeatmap ? 'bg-orange-500 text-white' : 'bg-white/90 text-gray-600'}`}
          title="Demand Heatmap"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowAlarms(v => !v)}
          className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-lg flex items-center justify-center relative"
        >
          <Bell className="w-4 h-4 text-gray-600" />
          {alarms.filter(a => !a.triggered).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {alarms.filter(a => !a.triggered).length}
            </span>
          )}
        </button>
        <button onClick={fetchBuses} className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl border border-gray-200 shadow-lg flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-40" />
              <p className="text-sm">Loading live map…</p>
            </div>
          </div>
        ) : (
          <LiveMap
            positions={filtered}
            heatPoints={showHeatmap ? heatPoints : []}
            selectedBusId={selected?.bus}
            onBusClick={handleSelectBus}
          />
        )}
      </div>

      {/* Alarms Panel */}
      {showAlarms && (
        <div className="absolute top-16 right-3 z-40 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-600" />
              <span className="font-semibold text-sm text-gray-800">Bus Alarms</span>
            </div>
            <button onClick={() => setShowAlarms(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          {alarms.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No alarms set</p>
              <p className="text-xs mt-1">Tap a bus on the map → 🔔 to set alarm</p>
            </div>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {alarms.map(alarm => (
                <div key={alarm.busId} className={`px-4 py-3 flex items-center gap-3 ${alarm.triggered ? 'opacity-50' : ''}`}>
                  <Bus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Bus {alarm.busNumber ?? alarm.busId.slice(-4)}</p>
                    <p className="text-xs text-gray-400">Alarm within {alarm.radius}m</p>
                  </div>
                  {alarm.triggered
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <button onClick={() => setAlarms(prev => prev.filter(a => a.busId !== alarm.busId))} className="text-gray-300 hover:text-red-500 transition">
                        <X className="w-4 h-4" />
                      </button>
                  }
                </div>
              ))}
            </div>
          )}
          {/* Location alarm */}
          <div className="px-4 py-3 border-t bg-blue-50">
            <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5 mb-1">
              <MapPin className="w-3 h-3" /> Destination Alarm
            </p>
            {locAlarm ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-blue-600">Alarm active within {locAlarm.radius}m</p>
                <button onClick={() => setLocAlarm(null)} className="text-xs text-red-500">Remove</button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!userLoc) { toast.error('Enable GPS first'); return; }
                  setLocAlarm({ ...userLoc, radius: 300 });
                  toast.success('📍 Destination alarm set at your current location (300m radius)');
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"
              >
                Set at my location
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Bus Panel */}
      {showPanel && selected && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] p-5 z-40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900">{(selected as any).busNumber ?? `Bus ${selected.bus.slice(-4)}`}</h3>
              <p className="text-xs text-blue-600">{(selected as any).routeName ?? 'Live bus'}</p>
            </div>
            <button onClick={() => { setShowPanel(false); setSelected(null); }} className="text-gray-300 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ETA */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">AI-Predicted ETA</span>
            </div>
            {etaLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" /> Calculating…
              </div>
            ) : eta ? (
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-indigo-700">{eta.etaMinutes}</span>
                <span className="text-gray-500 text-sm pb-1">min to next stop</span>
                <span className={`ml-auto text-sm font-semibold ${congestionColor[eta.congestionLevel]}`}>{eta.congestionLevel} traffic</span>
              </div>
            ) : null}
          </div>

          {/* Telemetry Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Speed',      value: `${(selected as any).speed ?? 0} km/h`,  color: 'text-blue-700',  bg: 'bg-blue-50' },
              { label: 'Delay',      value: (selected.delay_minutes ?? 0) > 0 ? `+${selected.delay_minutes}m` : 'On time', color: (selected.delay_minutes ?? 0) > 3 ? 'text-red-700' : 'text-green-700', bg: (selected.delay_minutes ?? 0) > 3 ? 'bg-red-50' : 'bg-green-50' },
              { label: 'Next Stop',  value: selected.nextStage?.stage_name?.split(' ').slice(0, 2).join(' ') ?? '—', color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${color} leading-tight`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => addBusAlarm(selected.bus, (selected as any).busNumber)}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 py-3 rounded-xl font-semibold text-sm transition hover:bg-yellow-100"
            >
              <Bell className="w-4 h-4" /> Set Alarm
            </button>
            <button
              onClick={() => fetchETA(selected)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm transition hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" /> Refresh ETA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
