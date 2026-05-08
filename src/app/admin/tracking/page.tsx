'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import type { BusPosition } from '@/types';
import {
  Navigation, Wifi, Layers, BarChart2, RefreshCw, Bus,
  Clock, Zap, MapPin, X, ChevronRight, Filter, Shield, AlertTriangle, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { timeAgo } from '@/lib/utils';

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

interface AnomalyResult {
  is_anomaly:   boolean;
  score:        number;
  confidence:   number;
  reason:       string;
  model:        string;
  metrics:      { precision?: number; recall?: number; f1?: number };
}

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false });

interface HeatPoint { lat: number; lng: number; intensity: number; }
interface RouteOption { _id: string; route_name: string; }

export default function TrackingPage() {
  const [positions,      setPositions]      = useState<BusPosition[]>([]);
  const [connected,      setConnected]      = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [showHeatmap,    setShowHeatmap]    = useState(false);
  const [heatPoints,     setHeatPoints]     = useState<HeatPoint[]>([]);
  const [heatLoading,    setHeatLoading]    = useState(false);
  const [selectedBus,    setSelectedBus]    = useState<BusPosition | null>(null);
  const [routeFilter,    setRouteFilter]    = useState('');
  const [routes,         setRoutes]         = useState<RouteOption[]>([]);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [dispatchRoute,  setDispatchRoute]  = useState('');
  const [dispatching,    setDispatching]    = useState(false);
  const [showDispatch,   setShowDispatch]   = useState(false);
  const [anomaly,        setAnomaly]        = useState<AnomalyResult | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [crowdMarkers,   setCrowdMarkers]   = useState<{ lat: number; lng: number; count: number; level: string }[]>([]);

  const stats = {
    delayed: positions.filter(p => (p.delay_minutes ?? 0) > 5).length,
    onTime:  positions.filter(p => (p.delay_minutes ?? 0) <= 5).length,
  };

  const fetchHeatmap = useCallback(async () => {
    setHeatLoading(true);
    try {
      const hour = new Date().getHours();
      const date = new Date().toISOString().split('T')[0];
      const { data } = await api.get(`/demand/heatmap?date=${date}&hour=${hour}`);
      const raw: any[] = data.points || data.heatmap || [];
      // Heat layer (normalised 0-1)
      const pts: HeatPoint[] = raw.map((d: any) => ({
        lat: d.lat, lng: d.lng,
        intensity: Math.min(1, (d.intensity ?? d.predictedCount ?? 50) / 200),
      }));
      setHeatPoints(pts);
      // Crowd markers (coloured circles per stop)
      const lvl = (count: number) =>
        count > 150 ? 'critical' : count > 80 ? 'high' : count > 30 ? 'medium' : 'low';
      const markers = raw
        .filter((d: any) => d.lat && d.lng)
        .map((d: any) => ({
          lat: d.lat, lng: d.lng,
          count: d.intensity ?? d.predictedCount ?? 0,
          level: lvl(d.intensity ?? d.predictedCount ?? 0),
        }));
      setCrowdMarkers(markers);
    } catch {
      toast.error('Failed to load heatmap data');
    } finally {
      setHeatLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load routes for filter dropdown
    api.get('/routes?limit=100').then(({ data }) => setRoutes(data.routes || []));

    api.get('/tracking/live').then(({ data }) => {
      setPositions((data.positions || []).filter((pos: BusPosition) => !(pos as any).isSimulated));
      setLoading(false);
    });

    const socket = connectSocket();
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('admin:subscribe_all');

    socket.on('bus:location_update', (pos: BusPosition) => {
      if ((pos as any).isSimulated) return;
      setPositions(prev => {
        const idx = prev.findIndex(p => p.bus === pos.bus);
        let next;
        if (idx >= 0) { next = [...prev]; next[idx] = pos; }
        else next = [pos, ...prev];
        return next;
      });
      // Update selected bus detail if it matches
      setSelectedBus(curr => curr && curr.bus === pos.bus ? { ...curr, ...pos } : curr);
    });

    socket.on('alert:new', (a: any) => {
      if (a.severity === 'critical') toast.error(`🚨 ${a.message}`, { duration: 6000 });
    });

    return () => {
      socket.off('bus:location_update');
      socket.off('alert:new');
    };
  }, []);

  useEffect(() => {
    if (showHeatmap) fetchHeatmap();
  }, [showHeatmap, fetchHeatmap]);

  const filtered = routeFilter
    ? positions.filter(p => (p as any).routeId === routeFilter || (p as any).route === routeFilter)
    : positions;

  const checkAnomaly = useCallback(async (pos: BusPosition) => {
    setAnomalyLoading(true); setAnomaly(null);
    try {
      const res = await fetch(`${AI_URL}/detect/anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_kmh:      (pos as any).speed ?? 30,
          delay_minutes:  pos.delay_minutes ?? 0,
          passenger_load: (pos as any).passenger_load ?? 60,
          model_key:      'auto',
        }),
      });
      const data: AnomalyResult = await res.json();
      setAnomaly(data);
      if (data.is_anomaly) {
        toast.error(`🚨 Anomaly on Bus ${(pos as any).busNumber ?? '—'}: ${data.reason}`, { duration: 5000 });
      }
    } catch {
      setAnomaly(null);
    } finally { setAnomalyLoading(false); }
  }, []);

  const emergencyDispatch = async () => {
    if (!dispatchRoute) return toast.error('Select a route');
    setDispatching(true);
    try {
      await api.post('/schedule/emergency', { routeId: dispatchRoute });
      toast.success('Emergency bus dispatched!');
      setShowDispatch(false);
    } catch {
      toast.error('Emergency dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3" style={{ minHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Live Tracking</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats */}
          <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-green-100 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            {stats.onTime} On Time
          </span>
          <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-red-100 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {stats.delayed} Delayed
          </span>

          {/* Route filter */}
          <div className="flex items-center gap-1 border rounded-lg px-2 py-1.5 bg-white text-sm">
            <Filter className="w-3 h-3 text-gray-400" />
            <select
              value={routeFilter}
              onChange={e => { setRouteFilter(e.target.value); setSelectedBus(null); }}
              className="bg-transparent text-sm focus:outline-none text-gray-700 max-w-[140px]"
            >
              <option value="">All Routes</option>
              {routes.map(r => (
                <option key={r._id} value={r._id}>{r.route_name}</option>
              ))}
            </select>
          </div>

          {/* Heatmap toggle */}
          <button
            onClick={() => { setShowHeatmap(v => { if (v) { setCrowdMarkers([]); setHeatPoints([]); } return !v; }); }}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition ${showHeatmap ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white border-gray-300 text-gray-600 hover:border-orange-400'}`}
          >
            <Layers className="w-4 h-4" />
            {showHeatmap ? 'Hide' : 'Show'} Demand Heatmap
            {heatLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </button>

          {/* Emergency dispatch */}
          <button
            onClick={() => setShowDispatch(v => !v)}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
          >
            <Zap className="w-4 h-4" /> Emergency Dispatch
          </button>

          {/* Connection status */}
          <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            <Wifi className="w-4 h-4" />
            {connected ? 'Live' : 'Connecting…'} — {filtered.length} buses
          </div>
        </div>
      </div>

      {/* Emergency dispatch panel */}
      {showDispatch && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-semibold text-red-800 block mb-1">Dispatch Nearest Idle Bus To Route</label>
            <select
              value={dispatchRoute}
              onChange={e => setDispatchRoute(e.target.value)}
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Select overcrowded route…</option>
              {routes.map(r => <option key={r._id} value={r._id}>{r.route_name}</option>)}
            </select>
          </div>
          <button onClick={emergencyDispatch} disabled={dispatching}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {dispatching ? 'Dispatching…' : '🚨 Dispatch Now'}
          </button>
          <button onClick={() => setShowDispatch(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
      )}

      {/* Heatmap legend */}
      {showHeatmap && (
        <div className="flex items-center gap-4 bg-white rounded-xl px-4 py-2.5 border shadow-sm text-xs text-gray-600 flex-wrap">
          <BarChart2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="font-medium">Heat Intensity:</span>
          <div className="flex items-center gap-1">
            <div className="h-3 w-16 rounded" style={{ background: 'linear-gradient(to right, #00f, #0ff, #0f0, #ff0, #f00)' }} />
          </div>
          <span className="text-gray-400">|</span>
          <span className="font-medium">Crowd Level:</span>
          {[['bg-green-500','Low'],['bg-yellow-400','Med'],['bg-orange-500','High'],['bg-red-500','Critical']].map(([bg, lbl]) => (
            <span key={lbl} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full ${bg} border border-white shadow-sm`} />
              {lbl}
            </span>
          ))}
          <span className="text-gray-400">|</span>
          <span>Hour: {new Date().getHours()}:00 · {heatPoints.length} stops · {crowdMarkers.filter(c=>c.level==='critical').length} critical</span>
          <button onClick={fetchHeatmap} className="ml-auto text-blue-600 hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      )}

      {/* Main content: map + sidebar */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Bus list sidebar */}
        {sidebarOpen && (
          <div className="w-64 flex-shrink-0 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Active Buses ({filtered.length})</span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Bus className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No buses active</p>
                </div>
              ) : filtered.map(pos => {
                const delayed = (pos.delay_minutes ?? 0) > 5;
                const isSelected = selectedBus?.bus === pos.bus;
                return (
                  <button
                    key={pos.bus}
                    onClick={() => { setSelectedBus(isSelected ? null : pos); if (!isSelected) checkAnomaly(pos); }}
                    className={`w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${delayed ? 'bg-red-500' : 'bg-green-500'}`} />
                        <span className="text-sm font-semibold text-gray-800">{(pos as any).busNumber || pos.bus?.toString().slice(-6) || 'Bus'}</span>
                      </div>
                      {isSelected && <ChevronRight className="w-3 h-3 text-blue-500" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{(pos as any).speed ?? 0} km/h</span>
                      <span className={`px-1 py-0.5 rounded text-xs ${delayed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {delayed ? `+${pos.delay_minutes}m` : 'On time'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative rounded-xl overflow-hidden border shadow-sm min-h-[450px]">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-10 bg-white border rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 shadow flex items-center gap-1"
            >
              <Bus className="w-3 h-3" /> Show Bus List ({filtered.length})
            </button>
          )}

          {loading ? (
            <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400">
              <Navigation className="w-6 h-6 animate-spin mr-2" /> Loading map…
            </div>
          ) : (
            <LiveMap
              positions={filtered}
              heatPoints={showHeatmap ? heatPoints : []}
              crowdMarkers={showHeatmap ? crowdMarkers : []}
              selectedBusId={selectedBus?.bus}
              onBusClick={pos => setSelectedBus(pos)}
            />
          )}
        </div>

        {/* Bus detail panel */}
        {selectedBus && (
          <div className="w-72 flex-shrink-0 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className={`px-4 py-3 text-white flex items-center justify-between bg-gradient-to-r ${
              anomaly?.is_anomaly ? 'from-red-600 to-rose-600' : 'from-blue-600 to-indigo-600'
            }`}>
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4" />
                <span className="font-semibold">{(selectedBus as any).busNumber || 'Bus Details'}</span>
                {anomaly?.is_anomaly && <AlertTriangle className="w-4 h-4 text-yellow-300" />}
              </div>
              <button onClick={() => { setSelectedBus(null); setAnomaly(null); }} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {[
                { label: 'Delay',       value: (selectedBus.delay_minutes ?? 0) > 0 ? `+${selectedBus.delay_minutes} min` : 'On time', icon: Clock,     color: (selectedBus.delay_minutes ?? 0) > 5 ? 'text-red-600' : 'text-green-600' },
                { label: 'Speed',       value: `${(selectedBus as any).speed ?? 0} km/h`,              icon: Zap,       color: 'text-blue-600' },
                { label: 'Next Stop',   value: (selectedBus.nextStage as any)?.stage_name ?? '—',       icon: MapPin,    color: 'text-purple-600' },
                { label: 'Last Update', value: timeAgo(selectedBus.timestamp),                           icon: RefreshCw, color: 'text-gray-500' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                </div>
              ))}

              {/* AI Anomaly Detection Panel */}
              <div className={`rounded-lg p-3 border ${
                anomalyLoading ? 'bg-gray-50 border-gray-200' :
                anomaly?.is_anomaly ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 ${
                    anomalyLoading ? 'text-gray-400 animate-pulse' :
                    anomaly?.is_anomaly ? 'text-red-500' : 'text-green-500'
                  }`} />
                  <span className="text-xs font-semibold text-gray-700">AI Anomaly Detection</span>
                  {!anomalyLoading && anomaly && (
                    <span className="text-[10px] text-gray-400 ml-auto">{anomaly.model}</span>
                  )}
                </div>
                {anomalyLoading ? (
                  <p className="text-xs text-gray-400">Analysing with ensemble model…</p>
                ) : anomaly ? (
                  <>
                    <div className="flex items-center gap-2">
                      {anomaly.is_anomaly
                        ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <CheckCircle   className="w-4 h-4 text-green-500 flex-shrink-0" />
                      }
                      <span className={`text-sm font-bold ${
                        anomaly.is_anomaly ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {anomaly.is_anomaly ? 'ANOMALY DETECTED' : 'Normal'}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">{Math.round(anomaly.confidence * 100)}%</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{anomaly.reason}</p>
                    {anomaly.metrics?.f1 != null && (
                      <p className="text-[10px] text-gray-400 mt-1">Model F1={anomaly.metrics.f1.toFixed(3)}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Click a bus to run anomaly check</p>
                )}
              </div>

              <button
                onClick={() => checkAnomaly(selectedBus)}
                disabled={anomalyLoading}
                className="w-full text-xs text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1 py-1 disabled:opacity-50"
              >
                {anomalyLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                Re-run Anomaly Check
              </button>

              {selectedBus.location?.coordinates && (
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">GPS Coordinates</p>
                  <p className="text-xs font-mono text-gray-700">
                    {selectedBus.location.coordinates[1]?.toFixed(5)}, {selectedBus.location.coordinates[0]?.toFixed(5)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedBus.location?.coordinates[1]}&mlon=${selectedBus.location?.coordinates[0]}&zoom=16`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 text-center text-xs bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 transition"
                >
                  View on OSM ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
