'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import type { BusPosition, Route } from '@/types';
import { Search, MapPin, Zap, Clock, Navigation, X, RefreshCw, Activity } from 'lucide-react';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

interface ETAResult {
  etaMinutes: number;
  predictedSpeed: number;
  congestionLevel: string;
}

export default function TrackPage() {
  const [positions, setPositions] = useState<BusPosition[]>([]);
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [selectedBus, setSelectedBus] = useState<BusPosition | null>(null);
  const [busETA,    setBusETA]    = useState<ETAResult | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [routeFilter, setRouteFilter] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPositions = useCallback(async () => {
    try {
      const [posRes, routeRes] = await Promise.all([
        api.get('/tracking/live'),
        api.get('/routes?limit=50'),
      ]);
      setPositions(posRes.data.positions || []);
      setRoutes(routeRes.data.routes || []);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPositions();
    const socket = connectSocket();
    socket.on('bus:location_update', (pos: BusPosition) => {
      setPositions(prev => {
        const idx = prev.findIndex(p => p.bus === pos.bus);
        if (idx >= 0) { const next = [...prev]; next[idx] = pos; return next; }
        return [pos, ...prev];
      });
      setLastUpdate(new Date());
    });
    return () => { socket.off('bus:location_update'); };
  }, [fetchPositions]);

  const fetchAIETA = useCallback(async (pos: BusPosition) => {
    setEtaLoading(true);
    setBusETA(null);
    try {
      const res = await fetch(`${AI_URL}/predict/eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_km: pos.distanceToNextStop ?? 2.5,
          hour: new Date().getHours(),
          day_of_week: new Date().getDay(),
          current_speed: pos.speed ?? 20,
          stops_remaining: pos.stopsRemaining ?? 5,
        }),
      });
      const data = await res.json();
      setBusETA({
        etaMinutes: data.predicted_eta_minutes ?? data.eta_minutes ?? Math.round((pos.distanceToNextStop ?? 2.5) / 0.4),
        predictedSpeed: data.predicted_speed_kmh ?? pos.speed ?? 20,
        congestionLevel: data.congestion_level ?? (pos.delay_minutes > 5 ? 'High' : pos.delay_minutes > 2 ? 'Medium' : 'Low'),
      });
    } catch {
      // graceful fallback: estimate from speed+distance
      setBusETA({
        etaMinutes: Math.round((pos.distanceToNextStop ?? 2.5) / Math.max(pos.speed ?? 20, 5) * 60),
        predictedSpeed: pos.speed ?? 20,
        congestionLevel: pos.delay_minutes > 5 ? 'High' : 'Low',
      });
    } finally {
      setEtaLoading(false);
    }
  }, []);

  const handleSelectBus = (pos: BusPosition) => {
    setSelectedBus(pos);
    fetchAIETA(pos);
  };

  const congestionColor: Record<string, string> = {
    Low: 'text-green-600 bg-green-50',
    Medium: 'text-yellow-600 bg-yellow-50',
    High: 'text-red-600 bg-red-50',
  };

  const filtered = positions.filter(pos => {
    const matchesSearch = !search || (pos.busNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchesRoute  = !routeFilter || pos.routeId === routeFilter;
    return matchesSearch && matchesRoute;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-dtc-blue text-white px-6 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Navigation className="w-5 h-5" /> DTC Live Tracker
        </h1>

        <div className="relative flex-1 max-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bus…"
            className="pl-9 pr-4 py-1.5 rounded-lg bg-white/20 placeholder-gray-300 text-white border border-white/30 focus:outline-none text-sm w-full"
          />
        </div>

        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none max-w-48"
        >
          <option value="">All Routes</option>
          {routes.map(r => (
            <option key={r._id} value={r._id} className="text-gray-900">{r.route_name || r.url_route_id}</option>
          ))}
        </select>

        <button onClick={fetchPositions} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 text-xs text-white/70 ml-auto">
          <Activity className="w-3 h-3 text-green-400" />
          <span>{filtered.length} buses live</span>
          <span>• Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </header>

      <div className="flex flex-1 h-[calc(100vh-56px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r overflow-y-auto flex-shrink-0">
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <Navigation className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active buses found</p>
              <p className="text-xs mt-1">Drivers must start their trip in the mobile app</p>
            </div>
          )}

          {filtered.map(pos => (
            <button
              key={pos.bus}
              onClick={() => handleSelectBus(pos)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition ${selectedBus?.bus === pos.bus ? 'bg-blue-50 border-l-4 border-l-dtc-blue' : ''}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-semibold text-gray-800 text-sm">{pos.busNumber || `Bus …${pos.bus.slice(-6)}`}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${pos.delay_minutes > 5 ? 'bg-red-100 text-red-600' : pos.delay_minutes > 2 ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                  {pos.delay_minutes > 0 ? `+${pos.delay_minutes}m late` : 'On time'}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {pos.nextStage?.stage_name || 'In transit'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{pos.speed ?? 0} km/h</p>
            </button>
          ))}
        </aside>

        {/* Map Area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                <p>Loading live positions…</p>
              </div>
            </div>
          ) : (
            <LiveMap positions={filtered} />
          )}

          {/* Selected Bus Detail Panel */}
          {selectedBus && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-white rounded-xl shadow-xl border p-4 z-40">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">{selectedBus.busNumber || 'Bus'}</h3>
                  <p className="text-xs text-dtc-blue font-medium">{selectedBus.routeName || 'Route'}</p>
                </div>
                <button onClick={() => { setSelectedBus(null); setBusETA(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AI ETA Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-semibold text-indigo-700">AI-Predicted ETA</span>
                </div>
                {etaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Calling AI model…
                  </div>
                ) : busETA ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-2xl font-bold text-indigo-700">{busETA.etaMinutes} min</span>
                      <span className="text-xs text-gray-500">to next stop</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${congestionColor[busETA.congestionLevel] ?? 'text-gray-600 bg-gray-50'}`}>
                        {busETA.congestionLevel} traffic
                      </span>
                      <span className="text-xs text-gray-500">{busETA.predictedSpeed} km/h predicted</span>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Live Telemetry */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Speed</p>
                  <p className="font-bold text-gray-800">{selectedBus.speed ?? 0}</p>
                  <p className="text-xs text-gray-400">km/h</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Delay</p>
                  <p className={`font-bold ${(selectedBus.delay_minutes ?? 0) > 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {(selectedBus.delay_minutes ?? 0) > 0 ? `+${selectedBus.delay_minutes}m` : '0'}
                  </p>
                  <p className="text-xs text-gray-400">minutes</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Next Stop</p>
                  <p className="font-bold text-gray-800 text-xs leading-tight mt-1" title={selectedBus.nextStage?.stage_name}>
                    {selectedBus.nextStage?.stage_name?.split(' ').slice(0, 2).join(' ') ?? '—'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => fetchAIETA(selectedBus)}
                className="mt-3 w-full text-xs text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh AI ETA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
