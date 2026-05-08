'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ArrowLeft, MapPin, Route, Clock, TrendingUp, BarChart2,
  RefreshCw, AlertCircle, Zap, Calendar, CloudRain, Sun,
  Wind, Thermometer, ToggleLeft, ToggleRight, Timer, Users,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const WEATHER_OPTIONS = ['clear', 'rain', 'heavy_rain', 'cloudy', 'fog', 'heatwave'] as const;
type Weather = typeof WEATHER_OPTIONS[number];

const WEATHER_ICONS: Record<Weather, React.ElementType> = {
  clear: Sun, rain: CloudRain, heavy_rain: CloudRain,
  cloudy: Wind, fog: Wind, heatwave: Thermometer,
};

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), { ssr: false });

interface Stage {
  _id: string; seq: number; stage_name: string;
  location: { coordinates: [number, number] };
  stage_id: number;
}
interface Route {
  _id: string; route_name: string; start_stage: string;
  end_stage: string; distance_km: number; total_stages: number;
  isActive: boolean; url_route_id: number;
}
interface DemandSlot { hour: string; predicted: number; crowd: string; }
interface DelayResult { predicted_delay_minutes: number; is_delayed: boolean; model: string; }

const CROWD_COLORS: Record<string, string> = {
  low: '#10b981', medium: '#f59e0b', high: '#f97316', very_high: '#ef4444', critical: '#dc2626',
};

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [route,    setRoute]    = useState<Route | null>(null);
  const [stages,   setStages]   = useState<Stage[]>([]);
  const [demand,   setDemand]   = useState<DemandSlot[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [demandLoading, setDemandLoading] = useState(false);
  const [search,   setSearch]   = useState('');

  // Forecast controls
  const [forecastDate,    setForecastDate]    = useState(() => new Date().toISOString().split('T')[0]);
  const [forecastWeather, setForecastWeather] = useState<Weather>('clear');

  // Delay prediction
  const [delay,        setDelay]        = useState<DelayResult | null>(null);
  const [delayLoading, setDelayLoading] = useState(false);

  // Route status toggle
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/routes/${id}`),
      api.get(`/routes/${id}/stages`).catch(() => api.get(`/stages?routeId=${id}&limit=300`)),
      api.get(`/schedule?routeId=${id}&limit=20`).catch(() => ({ data: { schedules: [] } })),
    ]).then(([routeRes, stagesRes, schedRes]) => {
      setRoute(routeRes.data.route);
      setStages(stagesRes.data.stages ?? stagesRes.data.data ?? []);
      setSchedules(schedRes.data.schedules ?? []);
    }).catch(() => toast.error('Failed to load route')).finally(() => setLoading(false));
  }, [id]);

  const buildDemandCurve = async () => {
    if (!route) return;
    setDemandLoading(true);
    setDemand([]);
    try {
      const dow = new Date(forecastDate).getDay();
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, h) =>
          api.post('/demand/predict', {
            route_id: id, date: forecastDate, hour: h,
            is_weekend: dow === 0 || dow === 6,
            weather: forecastWeather,
          }).then(({ data }) => ({
            hour: `${String(h).padStart(2,'0')}:00`,
            predicted: data.prediction?.predicted_count ?? 0,
            crowd: data.prediction?.crowd_level ?? 'low',
            model: data.prediction?.model ?? 'unknown',
          })).catch((err) => {
            const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
            console.error(`Demand predict failed for hour ${h}:`, msg);
            return null;
          })
        )
      );
      const valid = results.filter(Boolean) as { hour: string; predicted: number; crowd: string; model: string }[];
      if (valid.length === 0) {
        toast.error('Demand prediction failed — AI service unreachable');
      } else if (valid.length < 24) {
        toast(`⚠️ Got ${valid.length}/24 predictions — some failed`, { icon: '⚠️' });
      }
      setDemand(valid);
    } catch { toast.error('Demand prediction failed'); }
    finally { setDemandLoading(false); }
  };

  const predictDelay = async () => {
    setDelayLoading(true); setDelay(null);
    try {
      const { data } = await api.post('/ai/delay', {
        route_id:               id,
        distance_km:            route?.distance_km ?? 10,
        hour:                   new Date().getHours(),
        day_of_week:            new Date().getDay(),
        weather:                forecastWeather,
        passenger_load_pct:     60,
        total_stops:            stages.length || route?.total_stages || 20,
        scheduled_duration_min: Math.round((route?.distance_km ?? 10) * 3.5),
        is_weekend:             [0, 6].includes(new Date().getDay()),
        is_holiday:             false,
      });
      setDelay(data);
      toast.success(`Delay prediction: ${data.predicted_delay_minutes?.toFixed(1)} min`);
    } catch (err: any) {
      const raw = err?.response?.data?.error || err?.response?.data?.message || 'Delay prediction failed';
      const msg = Array.isArray(raw) ? raw.map((e: any) => e?.msg ?? JSON.stringify(e)).join('; ') : String(raw);
      toast.error(msg);
    } finally { setDelayLoading(false); }
  };

  const toggleActive = async () => {
    if (!route) return;
    setToggling(true);
    try {
      const { data } = await api.patch(`/routes/${id}`, { isActive: !route.isActive });
      setRoute(data.route ?? { ...route, isActive: !route.isActive });
      toast.success(`Route marked ${!route.isActive ? 'Active' : 'Inactive'}`);
    } catch { toast.error('Failed to update route status'); }
    finally { setToggling(false); }
  };

  const filtered = stages.filter(s => !search || s.stage_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading route…
    </div>
  );

  if (!route) return (
    <div className="text-center py-20">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">Route not found</p>
      <Link href="/admin/routes" className="text-blue-600 text-sm hover:underline mt-2 block">← Back to routes</Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/routes" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
            <Route className="w-5 h-5 text-blue-500" />
            Route {route.route_name}
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${route.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {route.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {route.start_stage} → {route.end_stage}
          </p>
        </div>
        {/* Active / Inactive toggle */}
        <button
          onClick={toggleActive}
          disabled={toggling}
          title={route.isActive !== false ? 'Deactivate route' : 'Activate route'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition disabled:opacity-50 ${
            route.isActive !== false
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          }`}
        >
          {toggling
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : route.isActive !== false
              ? <ToggleRight className="w-4 h-4" />
              : <ToggleLeft className="w-4 h-4" />
          }
          {route.isActive !== false ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Distance',    value: `${route.distance_km ?? '—'} km`,    icon: MapPin,     color: 'blue' },
          { label: 'Total Stops', value: `${stages.length || route.total_stages}`, icon: Route, color: 'purple' },
          { label: "Today's Trips", value: schedules.length,                  icon: Calendar,   color: 'green' },
          { label: 'Route ID',    value: route.url_route_id ?? route._id.slice(-6), icon: TrendingUp, color: 'orange' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm border">
            <Icon className={`w-5 h-5 text-${color}-500 mb-2`} />
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" /> Route Map
          </h2>
          <span className="text-xs text-gray-400">{stages.length} stops plotted</span>
        </div>
        <div className="h-64">
          {stages.length > 0
            ? <RouteMap stages={stages} />
            : <div className="h-full flex items-center justify-center text-gray-400">
                <MapPin className="w-5 h-5 mr-2" /> No stage coordinates available
              </div>
          }
        </div>
      </div>

      {/* Demand forecast panel */}
      <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" /> 24-Hour Demand Forecast
          </h2>
          <button
            onClick={buildDemandCurve}
            disabled={demandLoading}
            className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {demandLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {demandLoading ? 'Predicting…' : 'Run AI Forecast'}
          </button>
        </div>

        {/* Forecast controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={forecastDate}
              onChange={e => setForecastDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {WEATHER_OPTIONS.map(w => {
              const Icon = WEATHER_ICONS[w];
              return (
                <button key={w} onClick={() => setForecastWeather(w)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs capitalize transition ${
                    forecastWeather === w
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}>
                  <Icon className="w-3 h-3" /> {w.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Peak summary cards */}
        {demand.length > 0 && (() => {
          const peak = demand.reduce((a, b) => b.predicted > a.predicted ? b : a, demand[0]);
          const avg  = Math.round(demand.reduce((s, d) => s + d.predicted, 0) / demand.length);
          const total = demand.reduce((s, d) => s + d.predicted, 0);
          return (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-purple-700">{peak.hour}</p>
                <p className="text-xs text-purple-500 mt-0.5">Peak Hour</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                  {peak.crowd.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{peak.predicted}</p>
                <p className="text-xs text-blue-500 mt-0.5">Peak Passengers</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-700">{avg}</p>
                <p className="text-xs text-gray-500 mt-0.5">Avg / Hour</p>
                <p className="text-[10px] text-gray-400">{total} total est.</p>
              </div>
            </div>
          );
        })()}

        {demand.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            Select a date &amp; weather, then click &quot;Run AI Forecast&quot;
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={demand}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, _: string, entry: any) => [
                `${v} pax (${entry.payload.crowd})`, 'Predicted'
              ]} />
              <Bar dataKey="predicted" name="Predicted Passengers" radius={[2, 2, 0, 0]}>
                {demand.map((entry, idx) => (
                  <Cell key={idx} fill={CROWD_COLORS[entry.crowd] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AI Delay Prediction */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Timer className="w-4 h-4 text-orange-500" /> AI Delay Prediction
            <span className="text-xs text-gray-400 font-normal">current conditions · {forecastWeather}</span>
          </h2>
          <button
            onClick={predictDelay}
            disabled={delayLoading}
            className="flex items-center gap-2 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {delayLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            {delayLoading ? 'Predicting…' : 'Predict Delay'}
          </button>
        </div>
        {!delay && !delayLoading && (
          <p className="text-sm text-gray-400 text-center py-4">
            Click &quot;Predict Delay&quot; to estimate arrival delay for current hour &amp; conditions
          </p>
        )}
        {delay && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`flex-1 rounded-xl p-4 text-center ${delay.is_delayed ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-3xl font-black ${delay.is_delayed ? 'text-red-600' : 'text-green-600'}`}>
                {delay.predicted_delay_minutes != null ? `+${delay.predicted_delay_minutes.toFixed(1)} min` : '—'}
              </p>
              <p className={`text-xs mt-1 ${delay.is_delayed ? 'text-red-500' : 'text-green-500'}`}>
                {delay.is_delayed ? '⚠️ Delay expected' : '✅ On time expected'}
              </p>
            </div>
            <div className="text-xs text-gray-400 space-y-1 shrink-0">
              <p>Model: <span className="font-medium text-gray-700">{delay.model ?? '—'}</span></p>
              <p>Weather: <span className="font-medium text-gray-700 capitalize">{forecastWeather.replace('_', ' ')}</span></p>
              <p>Hour: <span className="font-medium text-gray-700">{new Date().getHours()}:00</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Today's Schedules */}
      {schedules.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Today&apos;s Schedule ({schedules.length} trips)</h2>
          </div>
          <div className="divide-y max-h-48 overflow-y-auto">
            {schedules.map(s => (
              <div key={s._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">
                    {s.departureTime ? new Date(s.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-600">
                    {s.estimatedArrivalTime ? new Date(s.estimatedArrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">{s.bus?.busNumber ?? '—'}</span>
                  <span className={`px-1.5 py-0.5 rounded-full capitalize font-medium ${
                    s.status === 'completed'    ? 'bg-green-100 text-green-700' :
                    s.status === 'in-progress'  ? 'bg-blue-100 text-blue-700' :
                    s.status === 'cancelled'    ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stops list */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500" /> Stop Sequence ({filtered.length} stops)
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stop…"
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                {['Seq', 'Stop Name', 'Latitude', 'Longitude'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No stops found</td></tr>
              ) : filtered.map(s => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 text-xs">{s.seq}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{s.stage_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {s.location?.coordinates?.[1]?.toFixed(5) ?? '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {s.location?.coordinates?.[0]?.toFixed(5) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
