'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import type { DashboardSummary, Alert, BusPosition } from '@/types';
import {
  Bus, AlertTriangle, CheckCircle, TrendingUp, RefreshCw,
  Activity, Clock, Zap, Radio, Navigation, Users, BarChart2,
  ArrowUpRight, ArrowDownRight, Server, Database, Brain, Cpu,
  Star, Medal, Trophy, Wifi, WifiOff, ChevronRight, Ticket, Smartphone,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, RadialBarChart, RadialBar,
} from 'recharts';

interface DriverLeaderEntry {
  rank: number;
  name: string;
  totalTrips: number;
  otpPercent: number;
  avgDelay: number;
  rating: number;
}

interface SystemHealth {
  uptime: number;
  uptimeHuman: string;
  db: { status: string; healthy: boolean };
  sockets: { connected: number };
  ai: { status: string; models: Record<string, boolean> };
  memory: { used: number; total: number };
  data: { routes: number; buses: number; drivers: number; users: number };
}

interface WeeklyOTP { date: string; label: string; otp: number; total: number; completed: number }

export default function AdminDashboard() {
  const [summary,      setSummary]      = useState<DashboardSummary | null>(null);
  const [alerts,       setAlerts]       = useState<Alert[]>([]);
  const [liveBuses,    setLiveBuses]    = useState<BusPosition[]>([]);
  const [demandData,   setDemandData]   = useState<any[]>([]);
  const [leaderboard,  setLeaderboard]  = useState<DriverLeaderEntry[]>([]);
  const [health,       setHealth]       = useState<SystemHealth | null>(null);
  const [weeklyOTP,    setWeeklyOTP]    = useState<WeeklyOTP[]>([]);
  const [aiStats,      setAiStats]      = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [retraining,   setRetraining]   = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showBroadcast,setShowBroadcast]= useState(false);
  const [mobileStats,  setMobileStats]  = useState<any>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sumRes, alertRes, busRes, demandRes, leaderRes, healthRes, weeklyRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/alerts?isResolved=false&limit=5'),
        api.get('/tracking/live'),
        api.get('/reports/demand-by-hour').catch(() => ({ data: { hours: [] } })),
        api.get('/reports/driver-leaderboard').catch(() => ({ data: { leaderboard: [] } })),
        api.get('/reports/system-health').catch(() => ({ data: { health: null } })),
        api.get('/reports/weekly-otp').catch(() => ({ data: { trend: [] } })),
      ]);

      setSummary(sumRes.data.summary);
      setAlerts(alertRes.data.alerts ?? []);
      setLiveBuses(busRes.data.positions ?? []);
      setDemandData(demandRes.data.hours ?? []);
      setLeaderboard(leaderRes.data.leaderboard ?? []);
      setHealth(healthRes.data.health ?? null);
      setWeeklyOTP(weeklyRes.data.trend ?? []);
      setLastRefresh(new Date());

      // Fetch AI stats separately (may be offline)
      try {
        const aiRes = await fetch(`${process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000'}/stats`);
        if (aiRes.ok) setAiStats(await aiRes.json());
      } catch {}

      // Fetch mobile app stats (bookings)
      try {
        const mRes = await api.get('/admin/app-stats');
        if (mRes.data.success) setMobileStats(mRes.data.stats);
      } catch {}
    } catch {
      if (!silent) toast.error('Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    const socket = connectSocket();
    socket.emit('admin:subscribe_all');

    socket.on('alert:new', (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 5));
      if (alert.severity === 'critical')
        toast.error(`🚨 ${alert.type?.toUpperCase()}: ${alert.message}`, { duration: 8000, id: alert._id });
      else toast(`⚠️ ${alert.message}`, { duration: 5000, id: alert._id });
    });

    socket.on('bus:location_update', (pos: BusPosition) => {
      setLiveBuses(prev => {
        const idx = prev.findIndex(b => b.bus === pos.bus || b._id === pos._id);
        if (idx >= 0) { const next = [...prev]; next[idx] = pos; return next; }
        return [pos, ...prev];
      });
    });

    return () => {
      clearInterval(interval);
      socket.off('alert:new');
      socket.off('bus:location_update');
    };
  }, [fetchData]);

  const delayed   = liveBuses.filter(b => (b.delay_minutes ?? 0) > 5).length;
  const avgDelay  = liveBuses.length
    ? Math.round(liveBuses.reduce((s, b) => s + (b.delay_minutes ?? 0), 0) / liveBuses.length)
    : 0;
  const totalBuses = Math.max(liveBuses.length, summary?.totalTripsToday ?? 20);
  const fleetUtil  = liveBuses.length ? Math.round((liveBuses.length / totalBuses) * 100) : 0;
  const otpPct     = liveBuses.length ? Math.round(((liveBuses.length - delayed) / liveBuses.length) * 100) : 0;

  const kpis = summary ? [
    { label: 'Trips Today',   value: summary.totalTripsToday, icon: Bus,          color: 'blue',   sub: `${summary.completedToday} completed`,   trend: 'up' },
    { label: 'Live Buses',    value: liveBuses.length,        icon: Activity,     color: 'indigo', sub: `${delayed} delayed`,                    trend: delayed > 2 ? 'down' : 'up' },
    { label: 'Avg Delay',     value: `${avgDelay} min`,       icon: Clock,        color: 'yellow', sub: avgDelay < 5 ? 'On schedule' : 'Attention needed', trend: avgDelay < 5 ? 'up' : 'down' },
    { label: 'On-Time %',     value: `${otpPct}%`,            icon: TrendingUp,   color: 'green',  sub: 'Target: 85%',                           trend: otpPct >= 85 ? 'up' : 'down' },
    { label: 'Active Alerts', value: summary.activeAlerts,    icon: AlertTriangle,color: 'orange', sub: `${summary.criticalAlerts} critical`,    trend: summary.criticalAlerts > 0 ? 'down' : 'up' },
    { label: 'Fleet Util.',   value: `${fleetUtil}%`,         icon: Radio,        color: 'purple', sub: `${liveBuses.length}/${totalBuses} active`,trend: fleetUtil > 60 ? 'up' : 'down' },
  ] : [];

  const generateSchedule = async () => {
    setGeneratingSchedule(true);
    try {
      const routesRes = await api.get('/routes?limit=10');
      const routes = routesRes.data.routes ?? [];
      if (!routes.length) return toast.error('No routes found');
      const today = new Date().toISOString().split('T')[0];
      const { data } = await api.post('/schedule/generate-ai', {
        date: today, routeIds: routes.slice(0, 5).map((r: any) => r._id), totalBusesAvailable: 10,
      });
      toast.success(`AI generated schedules for ${data.schedules?.length ?? 0} routes!`);
      fetchData(true);
    } catch {
      toast.error('Schedule generation failed — ensure AI service is running');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const triggerRetrain = async () => {
    setRetraining(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000'}/admin/retrain`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retrain_xgboost: true, retrain_lstm: false, retrain_anomaly: true }),
      });
      if (res.ok) toast.success('AI retraining started in background (~2 min)');
      else toast.error('Retrain failed');
    } catch {
      toast.error('AI service offline');
    } finally {
      setRetraining(false);
    }
  };

  const broadcastAlert = async () => {
    if (!broadcastMsg.trim()) return toast.error('Enter a message');
    setBroadcasting(true);
    try {
      await api.post('/alerts', { type: 'route-change', severity: 'info', message: broadcastMsg });
      toast.success('Alert broadcast to all passengers');
      setBroadcastMsg('');
      setShowBroadcast(false);
      fetchData(true);
    } catch {
      toast.error('Failed to broadcast');
    } finally {
      setBroadcasting(false);
    }
  };

  const rankMedal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">DTC Control Centre</h1>
          <p className="text-sm text-gray-500 mt-0.5">SmartDTC — AI-Driven Bus Scheduling & Route Management</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Last refresh: {lastRefresh.toLocaleTimeString('en-IN')}</span>
          <button onClick={() => fetchData()} className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading dashboard…</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpis.map(({ label, value, icon: Icon, color, sub, trend }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 text-${color}-500`} />
                  {trend === 'up'
                    ? <ArrowUpRight className="w-4 h-4 text-green-500" />
                    : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                </div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{label}</p>
                <p className="text-xs text-gray-400 truncate">{sub}</p>
              </div>
            ))}
          </div>

          {/* Fleet Utilization */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" /> Fleet Utilization
              </span>
              <span className="text-sm font-bold text-gray-800">{liveBuses.length} active / {totalBuses} total</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700" style={{ width: `${fleetUtil}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs">
              <span className="text-green-600">{liveBuses.length - delayed} on time</span>
              <span className="text-yellow-600">{delayed} delayed</span>
              <span className="text-gray-400">OTP: {otpPct}%</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <button onClick={generateSchedule} disabled={generatingSchedule}
              className="flex flex-col items-center gap-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-sm">
              {generatingSchedule ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
              <span className="text-sm font-medium">{generatingSchedule ? 'Generating…' : 'AI Schedule'}</span>
            </button>

            <a href="/admin/tracking" className="flex flex-col items-center gap-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4 rounded-xl hover:opacity-90 transition shadow-sm">
              <Navigation className="w-6 h-6" />
              <span className="text-sm font-medium">Live Tracking</span>
            </a>

            <a href="/admin/bookings" className="flex flex-col items-center gap-2 bg-gradient-to-br from-orange-400 to-orange-600 text-white p-4 rounded-xl hover:opacity-90 transition shadow-sm">
              <Ticket className="w-6 h-6" />
              <span className="text-sm font-medium">Bookings</span>
              {mobileStats?.todayBookings > 0 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{mobileStats.todayBookings} today</span>
              )}
            </a>

            <button onClick={() => setShowBroadcast(v => !v)}
              className="flex flex-col items-center gap-2 bg-gradient-to-br from-red-500 to-rose-600 text-white p-4 rounded-xl hover:opacity-90 transition shadow-sm">
              <Radio className="w-6 h-6" />
              <span className="text-sm font-medium">Broadcast</span>
            </button>

            <a href="/admin/demand" className="flex flex-col items-center gap-2 bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-4 rounded-xl hover:opacity-90 transition shadow-sm">
              <Users className="w-6 h-6" />
              <span className="text-sm font-medium">Demand AI</span>
            </a>

            <button onClick={triggerRetrain} disabled={retraining}
              className="flex flex-col items-center gap-2 bg-gradient-to-br from-teal-500 to-green-600 text-white p-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-sm">
              {retraining ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Brain className="w-6 h-6" />}
              <span className="text-sm font-medium">{retraining ? 'Retraining…' : 'Retrain AI'}</span>
            </button>
          </div>

          {/* Broadcast input */}
          {showBroadcast && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-orange-800 block mb-1">Broadcast Message to Passengers</label>
                <input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="e.g. Route 236 suspended due to road work near ITO…"
                  className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <button onClick={broadcastAlert} disabled={broadcasting}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {broadcasting ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}

          {/* Charts Row */}
          {demandData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-purple-500" /> Scheduled vs Completed Trips (Today)
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={demandData.filter(d => d.predicted > 0 || d.actual > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="predicted" name="Scheduled" fill="#8b5cf6" radius={[2,2,0,0]} />
                    <Bar dataKey="actual"    name="Completed" fill="#10b981" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly OTP Trend */}
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> 7-Day OTP Trend
                </h2>
                {weeklyOTP.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={weeklyOTP}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 8 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="otp" stroke="#6366f1" fill="#e0e7ff" name="OTP %" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    No OTP data yet — schedule some trips to see trends
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Model Status + System Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Model Status */}
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-500" /> AI Model Status
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                  health?.ai?.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {health?.ai?.status === 'ok' ? '● Online' : '● Offline'}
                </span>
              </h2>
              <div className="space-y-2">
                {[
                  {
                    label: 'Demand',
                    icon: '📈',
                    metric: aiStats ? `Best: ${aiStats.models?.demand?.best_model?.toUpperCase() ?? 'XGBoost'} · R²=${aiStats.models?.demand?.r2 ?? '0.9926'}` : 'LSTM/GRU/Transformer/XGBoost/LightGBM/RF',
                    sub: aiStats ? `MAE=${aiStats.models?.demand?.mae ?? 1.36} · MAPE=${aiStats.models?.demand?.mape ?? 6.01}%` : '6 models trained',
                    count: aiStats?.models?.demand?.loaded_models?.length ?? 6,
                  },
                  {
                    label: 'Delay',
                    icon: '⏱️',
                    metric: aiStats ? `Best: ${aiStats.models?.delay?.best_model?.toUpperCase() ?? 'XGBoost'} · R²=${aiStats.models?.delay?.r2 ?? '0.9516'}` : 'XGBoost/LightGBM/CatBoost/SVR/MLP/Ensemble',
                    sub: aiStats ? `MAE=${aiStats.models?.delay?.mae ?? 1.06} min` : '6 models trained',
                    count: aiStats?.models?.delay?.loaded_models?.length ?? 6,
                  },
                  {
                    label: 'Anomaly',
                    icon: '🛡️',
                    metric: aiStats ? `Best: ${aiStats.models?.anomaly?.best_model?.toUpperCase() ?? 'Autoencoder'} · F1=${aiStats.models?.anomaly?.f1 ?? '0.7448'}` : 'IForest/LOF/OCSVM/Autoencoder/DBSCAN/Ensemble',
                    sub: aiStats ? `Precision=${aiStats.models?.anomaly?.precision ?? 0.59} · Recall=${aiStats.models?.anomaly?.recall ?? 0.99}` : '6 detectors trained',
                    count: aiStats?.models?.anomaly?.loaded_models?.length ?? 6,
                  },
                  {
                    label: 'ETA Predictor',
                    icon: '🕐',
                    metric: 'Gradient Boosting · MAE ≈ 2.8 min',
                    sub: 'Real-time ETA estimation',
                    count: 1,
                  },
                ].map(({ label, icon, metric, sub, count }) => (
                  <div key={label} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500 truncate">{metric}</p>
                        <p className="text-xs text-gray-400 truncate">{sub}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0 ml-2">
                      {count} model{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {aiStats ? `${(100 - (aiStats.models?.demand?.mape ?? 6.01)).toFixed(1)}%` : '93.99%'}
                  </p>
                  <p className="text-xs text-gray-500">Demand Accuracy</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">
                    {aiStats ? aiStats.models?.delay?.r2 ?? '0.9516' : '0.9516'}
                  </p>
                  <p className="text-xs text-gray-500">Delay R²</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {aiStats ? aiStats.models?.anomaly?.f1 ?? '0.7448' : '0.7448'}
                  </p>
                  <p className="text-xs text-gray-500">Anomaly F1</p>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Server className="w-4 h-4 text-green-500" /> System Health
              </h2>
              {health ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Database',  value: health.db.status,                       icon: Database, ok: health.db.healthy },
                    { label: 'AI Service',value: health.ai.status,                       icon: Brain,    ok: health.ai.status === 'ok' },
                    { label: 'WebSockets',value: `${health.sockets.connected} connected`, icon: Wifi,    ok: true },
                    { label: 'Memory',    value: `${health.memory.used}/${health.memory.total} MB`, icon: Cpu, ok: health.memory.used < health.memory.total * 0.85 },
                    { label: 'Uptime',    value: health.uptimeHuman,                     icon: Clock,    ok: true },
                    { label: 'Routes',    value: `${health.data?.routes ?? '?'} routes`, icon: Navigation, ok: true },
                  ].map(({ label, value, icon: Icon, ok }) => (
                    <div key={label} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${ok ? 'text-green-500' : 'text-red-500'}`} />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`text-sm font-semibold truncate ${ok ? 'text-gray-800' : 'text-red-600'}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Health data unavailable</p>
                </div>
              )}
              {health && (
                <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                  <div><span className="font-bold text-gray-800">{health.data?.buses ?? '?'}</span><br/>Buses</div>
                  <div><span className="font-bold text-gray-800">{health.data?.drivers ?? '?'}</span><br/>Drivers</div>
                  <div><span className="font-bold text-gray-800">{health.data?.users ?? '?'}</span><br/>Users</div>
                </div>
              )}
            </div>
          </div>

          {/* Driver Leaderboard + Live Buses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Driver Leaderboard */}
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Driver Leaderboard
                  <span className="text-xs text-gray-400">(30 days)</span>
                </h2>
                <a href="/admin/drivers" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Medal className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No trip history yet — start trips to see rankings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map(d => (
                    <div key={d.rank} className={`flex items-center gap-3 p-2.5 rounded-lg ${d.rank <= 3 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                      <span className="text-lg w-8 text-center">{rankMedal(d.rank)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{d.name}</p>
                        <p className="text-xs text-gray-500">{d.totalTrips} trips · +{d.avgDelay.toFixed(1)} min avg delay</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-green-600">{d.otpPercent}%</p>
                        <p className="text-xs text-yellow-500 flex items-center gap-0.5 justify-end">
                          <Star className="w-3 h-3 fill-yellow-400" />{d.rating.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> Active Alerts
                </h2>
                <a href="/admin/alerts" className="text-xs text-blue-600 hover:underline">View all →</a>
              </div>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">All clear — no active alerts 🎉</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {alerts.map(a => (
                    <li key={a._id} className={`flex items-start gap-3 p-3 rounded-lg ${a.severity === 'critical' ? 'bg-red-50 border border-red-100' : a.severity === 'warning' ? 'bg-yellow-50 border border-yellow-100' : 'bg-blue-50 border border-blue-100'}`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === 'critical' ? 'text-red-500' : a.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{a.severity}</span>
                          <span className="text-xs bg-white px-1.5 py-0.5 rounded border">{a.type}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 leading-snug">{a.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Mobile App Stats */}
          {mobileStats && (
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-orange-500" /> Mobile App — Booking Analytics
                </h2>
                <a href="/admin/bookings" className="text-xs text-orange-500 hover:underline font-medium">Manage all →</a>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Bookings',   value: mobileStats.totalBookings,   color: 'text-gray-800',   bg: 'bg-gray-50' },
                  { label: 'Today\'s Bookings', value: mobileStats.todayBookings,   color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'This Week',         value: mobileStats.weekBookings,    color: 'text-blue-600',   bg: 'bg-blue-50' },
                  { label: 'Confirmed',         value: mobileStats.bookingsByStatus?.confirmed || 0, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Active Devices',    value: mobileStats.activeDevices,   color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {mobileStats.topRoutes?.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Most Booked Routes</p>
                  <div className="flex flex-wrap gap-2">
                    {mobileStats.topRoutes.map((r: any, i: number) => (
                      <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-full font-medium">
                        {r.name} <span className="font-bold">({r.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Buses */}
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" /> Live Buses ({liveBuses.length})
              </h2>
              <a href="/admin/tracking" className="text-xs text-blue-600 hover:underline">Open map →</a>
            </div>
            {liveBuses.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active buses — start the GPS simulator or driver app</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {liveBuses.slice(0, 16).map(pos => (
                  <div key={pos._id || pos.bus} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${(pos.delay_minutes ?? 0) > 5 ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                      <span className="font-medium text-gray-800 truncate">{(pos as any).busNumber || pos.bus?.toString().slice(-6)}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${(pos.delay_minutes ?? 0) > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {(pos.delay_minutes ?? 0) > 0 ? `+${pos.delay_minutes}m` : '✓'}
                    </span>
                  </div>
                ))}
                {liveBuses.length > 16 && (
                  <a href="/admin/tracking" className="flex items-center justify-center p-2 bg-blue-50 rounded-lg text-xs text-blue-600 hover:bg-blue-100 transition gap-1">
                    +{liveBuses.length - 16} more <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}