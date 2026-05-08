'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Search, MapPin, Clock, Bus, ArrowRight, ChevronRight,
  X, Zap, RefreshCw, Heart, AlertCircle, Map,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Route {
  _id: string; route_name: string; url_route_id: string;
  start_stage: string; end_stage: string;
  distance_km: number; total_stages: number;
}
interface Stage {
  _id: string; seq: number; stage_name: string;
  location: { coordinates: [number, number] };
}
interface Schedule {
  _id: string; departureTime: string; estimatedArrivalTime: string;
  status: string; type: string; bus?: { busNumber: string };
  delay?: number;
}
interface ETAData { predicted_delay_minutes: number; is_delayed: boolean; model: string; }

interface RouteMapProps { stages: Stage[]; liveBuses?: any[]; }
const RouteMap = dynamic<RouteMapProps>(() => import('@/components/map/RouteMap'), { ssr: false });

export default function PassengerSearch() {
  const [query,      setQuery]      = useState('');
  const [routes,     setRoutes]     = useState<Route[]>([]);
  const [selected,   setSelected]   = useState<Route | null>(null);
  const [stages,     setStages]     = useState<Stage[]>([]);
  const [schedules,  setSchedules]  = useState<Schedule[]>([]);
  const [etaData,    setEtaData]    = useState<ETAData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [schedLoading, setSchedLoading] = useState(false);
  const [showMap,    setShowMap]    = useState(true);
  const [favs,       setFavs]       = useState<Set<string>>(new Set());
  const debounceRef  = useRef<any>(null);

  const searchRoutes = useCallback(async (q: string) => {
    if (!q.trim()) { setRoutes([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/routes?search=${encodeURIComponent(q)}&limit=10`);
      setRoutes(data.routes || []);
    } catch {}
    setLoading(false);
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRoutes(v), 350);
  };

  const fetchSchedules = async (route: Route) => {
    setSelected(route); setRoutes([]); setQuery(''); setSchedules([]); setEtaData(null); setStages([]);
    setSchedLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const [schedRes, etaRes, stagesRes] = await Promise.allSettled([
        api.get(`/schedule?routeId=${route._id}&date=${date}&limit=10`),
        api.post('/demand/predict', { route_id: route._id, date, hour: new Date().getHours(), is_weekend: [0,6].includes(new Date().getDay()) }),
        api.get(`/routes/${route._id}/stages`),
      ]);
      if (schedRes.status === 'fulfilled')  setSchedules(schedRes.value.data.schedules || []);
      if (etaRes.status === 'fulfilled')    setEtaData(etaRes.value.data);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data.stages || []);
    } catch {}
    setSchedLoading(false);
  };

  const toggleFav = async (routeId: string, routeName: string) => {
    try {
      if (favs.has(routeId)) {
        await api.delete(`/mobile/passenger/favourites/${routeId}`);
        setFavs(prev => { const n = new Set(prev); n.delete(routeId); return n; });
        toast.success('Removed from saved routes');
      } else {
        await api.post('/mobile/passenger/favourites', { type: 'route', refId: routeId, label: routeName });
        setFavs(prev => new Set([...prev, routeId]));
        toast.success('⭐ Saved to favourites!');
      }
    } catch {}
  };

  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700', 'in-progress': 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* Search header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search route name, number or stop…"
            className="w-full pl-9 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition"
          />
          {query && (
            <button onClick={() => { setQuery(''); setRoutes([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {routes.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-30">
            {loading && <div className="text-center py-4 text-sm text-gray-400"><RefreshCw className="w-4 h-4 inline animate-spin mr-1" />Searching…</div>}
            {routes.map(r => (
              <button
                key={r._id}
                onClick={() => fetchSchedules(r)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b last:border-0 flex items-center gap-3"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bus className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{r.route_name}</p>
                  <p className="text-xs text-gray-400 truncate">{r.start_stage} → {r.end_stage} · {r.distance_km} km</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Route Detail */}
        {selected && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-blue-200 mb-1">Route</p>
                  <h2 className="font-bold text-lg leading-tight">{selected.route_name}</h2>
                  <div className="flex items-center gap-2 mt-2 text-xs text-blue-100">
                    <MapPin className="w-3 h-3" />{selected.start_stage}
                    <ArrowRight className="w-3 h-3" />
                    <MapPin className="w-3 h-3" />{selected.end_stage}
                  </div>
                </div>
                <button onClick={() => toggleFav(selected._id, selected.route_name)}>
                  <Heart className={`w-5 h-5 transition-colors ${favs.has(selected._id) ? 'text-red-400 fill-red-400' : 'text-white/50'}`} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold">{selected.distance_km ?? '—'}</p>
                  <p className="text-[10px] text-blue-200">km route</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold">{stages.length || selected.total_stages || '—'}</p>
                  <p className="text-[10px] text-blue-200">total stops</p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-2 text-center">
                  <p className="text-xl font-bold">{schedules.length || '—'}</p>
                  <p className="text-[10px] text-blue-200">trips today</p>
                </div>
              </div>
            </div>

            {/* AI Delay Prediction */}
            {etaData && (
              <div className={`mx-4 mt-4 rounded-xl p-3 flex items-center gap-3 ${etaData.is_delayed ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                <Zap className={`w-5 h-5 flex-shrink-0 ${etaData.is_delayed ? 'text-red-500' : 'text-green-500'}`} />
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    {etaData.is_delayed
                      ? `⚠️ Delays expected (+${etaData.predicted_delay_minutes.toFixed(0)} min avg)`
                      : '✅ Running on schedule'}
                  </p>
                  <p className="text-[10px] text-gray-400">AI model: {etaData.model}</p>
                </div>
              </div>
            )}

            {/* Today's Schedules */}
            <div className="p-4">
              <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Today's Schedule
              </p>
              {schedLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scheduled trips today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map(s => (
                    <div key={s._id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">{timeStr(s.departureTime)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className="text-sm text-gray-600">{timeStr(s.estimatedArrivalTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.bus && <span className="text-[10px] text-gray-400">Bus {s.bus.busNumber}</span>}
                          <span className="text-[10px] capitalize text-gray-400">{s.type}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Route Map */}
            <div className="px-4 pb-2">
              <button
                onClick={() => setShowMap(m => !m)}
                className="w-full flex items-center justify-between text-sm font-bold text-gray-900 py-2 mb-2"
              >
                <span className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-blue-600" />
                  Route Map
                  {stages.length > 0 && (
                    <span className="text-xs font-normal text-gray-400 ml-1">{stages.length} stops</span>
                  )}
                </span>
                <span className="text-xs text-blue-600">{showMap ? 'Hide' : 'Show'}</span>
              </button>

              {showMap && (
                <div className="rounded-2xl overflow-hidden border border-gray-200" style={{ height: 340 }}>
                  {schedLoading ? (
                    <div className="h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400 text-sm">
                      Loading map…
                    </div>
                  ) : stages.length === 0 ? (
                    <div className="h-full bg-gray-50 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                      <Map className="w-8 h-8 opacity-30" />
                      No stop coordinates available
                    </div>
                  ) : (
                    <RouteMap stages={stages} />
                  )}
                </div>
              )}

              {/* Stop list */}
              {showMap && stages.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto space-y-1 pr-1">
                  {stages.map((s, idx) => (
                    <div key={s._id} className="flex items-center gap-3 py-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                        idx === 0 ? 'bg-green-500' : idx === stages.length - 1 ? 'bg-red-500' : 'bg-blue-500'
                      }`}>{s.seq}</div>
                      <span className="text-sm text-gray-700 flex-1 truncate">{s.stage_name}</span>
                      {idx === 0 && <span className="text-[10px] text-green-600 font-medium shrink-0">Origin</span>}
                      {idx === stages.length - 1 && <span className="text-[10px] text-red-600 font-medium shrink-0">Terminal</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Book CTA */}
            <div className="px-4 pb-4">
              <Link
                href={`/passenger/booking?routeId=${selected._id}&routeName=${encodeURIComponent(selected.route_name)}`}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-orange-200"
              >
                <Bus className="w-4 h-4" /> Book a Seat on this Route
              </Link>
            </div>
          </div>
        )}

        {/* Default state */}
        {!selected && !query && (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">Search for a route</p>
            <p className="text-sm mt-1">Type a route name, number, or stop name</p>
          </div>
        )}
      </div>
    </div>
  );
}
