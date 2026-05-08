'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  BarChart2, Zap, RefreshCw, CloudRain, Sun, Wind, Thermometer,
  Users, AlertTriangle, TrendingUp, GitCompare, Grid, Brain,
  Trophy, CheckCircle, ChevronDown, ChevronUp, Award, Cpu,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Route { _id: string; route_name: string; }

interface ModelMetrics {
  mae?: number; rmse?: number; mape?: number; r2?: number;
  precision?: number; recall?: number; f1?: number;
  train_time_sec?: number; best_iter?: number;
}

interface ComparisonReport {
  task?: string;
  best_model?: string;
  loaded?: string[];
  comparison?: {
    models?: Record<string, ModelMetrics>;
  };
}

interface PredictionResult {
  predicted_count: number;
  crowd_level: string;
  confidence: number;
  model: string;
  is_best_model: boolean;
  metrics: ModelMetrics;
  peak_factor?: number;
}

interface AllModelsResult {
  best_model: string;
  model_results: Record<string, {
    predicted_count: number;
    crowd_level: string;
    confidence: number;
    metrics: ModelMetrics;
  }>;
}

interface HistoryRow {
  _id: string;
  route: { route_name: string };
  predictedCount: number;
  actualCount: number;
  crowdLevel: string;
  createdAt: string;
  modelUsed?: string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */
const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

const MODEL_LABELS: Record<string, string> = {
  lstm: 'LSTM', gru: 'GRU', transformer: 'Transformer',
  xgboost: 'XGBoost', lightgbm: 'LightGBM', random_forest: 'Random Forest',
};
const MODEL_COLORS: Record<string, string> = {
  lstm: '#8b5cf6', gru: '#06b6d4', transformer: '#f59e0b',
  xgboost: '#10b981', lightgbm: '#3b82f6', random_forest: '#f97316',
};
const CROWD_BG: Record<string, string> = {
  low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};
const WEATHER_OPTIONS = ['clear', 'rain', 'fog', 'heatwave'];
const WEATHER_ICONS: Record<string, any> = {
  clear: Sun, rain: CloudRain, fog: Wind, heatwave: Thermometer,
};

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function DemandPage() {
  const [routes,       setRoutes]       = useState<Route[]>([]);
  const [routeId,      setRouteId]      = useState('');
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [hour,         setHour]         = useState(new Date().getHours());
  const [weather,      setWeather]      = useState('clear');
  const [isHoliday,    setIsHoliday]    = useState(false);
  const [special,      setSpecial]      = useState(false);
  const [modelKey,     setModelKey]     = useState('auto');
  const [result,       setResult]       = useState<PredictionResult | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [history,      setHistory]      = useState<HistoryRow[]>([]);
  const [dayCurve,     setDayCurve]     = useState<any[]>([]);
  const [curveLoad,    setCurveLoad]    = useState(false);
  const [allModels,    setAllModels]    = useState<AllModelsResult | null>(null);
  const [allLoading,   setAllLoading]   = useState(false);
  const [compReport,   setCompReport]   = useState<ComparisonReport | null>(null);
  const [showMetrics,  setShowMetrics]  = useState(true);
  const [retraining,   setRetraining]   = useState(false);

  /* Trigger AI model retraining */
  const triggerRetrain = useCallback(async () => {
    if (!confirm('This will retrain XGBoost demand + anomaly models in the background (~2 min). Continue?')) return;
    setRetraining(true);
    try {
      const res = await fetch(`${AI_URL}/admin/retrain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retrain_xgboost: true, retrain_lstm: false, retrain_anomaly: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🔁 Retraining started! Models will refresh in ~2 minutes.');
      } else {
        toast.error('Retrain request failed');
      }
    } catch {
      toast.error('Could not reach AI service');
    } finally {
      setRetraining(false);
    }
  }, []);

  /* Fetch routes & comparison report on mount */
  useEffect(() => {
    api.get('/routes?limit=100').then(({ data }) => setRoutes(data.routes || []));
    fetch(`${AI_URL}/models/comparison`)
      .then(r => r.json())
      .then(d => setCompReport(d?.demand ?? null))
      .catch(() => {});
  }, []);

  /* Fetch history when route changes */
  useEffect(() => {
    if (!routeId) return;
    api.get(`/demand?routeId=${routeId}&limit=20`)
      .then(({ data }) => setHistory(data.demand || data.demands || []))
      .catch(() => {});
  }, [routeId]);

  /* Predict with selected model */
  const predict = useCallback(async () => {
    if (!routeId) { toast.error('Select a route first'); return; }
    setLoading(true); setResult(null);
    try {
      const dow = new Date(date).getDay();
      const { data } = await api.post('/demand/predict', {
        route_id: routeId, date, hour, model_key: modelKey === 'auto' ? undefined : modelKey,
        is_weekend: dow === 0 || dow === 6, is_holiday: isHoliday,
        weather, special_event: special,
      });
      setResult(data.prediction);
      toast.success(`✅ Prediction complete (${data.prediction?.model || 'AI'})`);
    } catch {
      toast.error('Prediction failed — is AI service running?');
    } finally { setLoading(false); }
  }, [routeId, date, hour, weather, isHoliday, special, modelKey]);

  /* Build 24h curve */
  const buildDayCurve = useCallback(async () => {
    if (!routeId) return;
    setCurveLoad(true); setDayCurve([]);
    try {
      const dow = new Date(date).getDay();
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, h) =>
          api.post('/demand/predict', {
            route_id: routeId, date, hour: h, model_key: modelKey === 'auto' ? undefined : modelKey,
            is_weekend: dow === 0 || dow === 6, is_holiday: isHoliday, weather, special_event: special,
          }).then(({ data }) => ({
            hour: `${String(h).padStart(2,'0')}:00`,
            predicted: data.prediction?.predicted_count ?? 0,
            crowd: data.prediction?.crowd_level ?? 'low',
          })).catch((err) => {
            const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
            console.error(`Demand predict failed for hour ${h}:`, msg);
            return null;
          })
        )
      );
      setDayCurve(results.filter(Boolean) as { hour: string; predicted: number; crowd: string }[]);
      const failed = results.filter(r => !r).length;
      if (failed === 24) toast.error('All predictions failed — AI service unreachable');
      else if (failed > 0) toast(`⚠️ ${failed}/24 predictions failed`, { icon: '⚠️' });
    } catch { toast.error('Failed to build curve'); }
    finally { setCurveLoad(false); }
  }, [routeId, date, weather, isHoliday, special, modelKey]);

  /* Run all 6 models */
  const runAllModels = useCallback(async () => {
    if (!routeId) { toast.error('Select a route first'); return; }
    setAllLoading(true); setAllModels(null);
    try {
      const dow = new Date(date).getDay();
      const { data } = await api.post('/demand/predict/all-models', {
        route_id: routeId, date, hour,
        is_weekend: dow === 0 || dow === 6,
        is_holiday: isHoliday, weather, special_event: special,
      });
      setAllModels(data);
      toast.success('All models compared!');
    } catch {
      toast.error('All-models run failed — check AI service');
    } finally { setAllLoading(false); }
  }, [routeId, date, hour, weather, isHoliday, special]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" /> Demand Prediction
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-model AI forecasting · {Object.keys(MODEL_LABELS).length} models compared ·
            Best: <span className="font-semibold text-purple-700">{MODEL_LABELS[compReport?.best_model ?? 'xgboost'] ?? compReport?.best_model ?? '—'}</span>
          </p>
        </div>
        <button
          onClick={triggerRetrain}
          disabled={retraining}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Cpu className={`w-4 h-4 ${retraining ? 'animate-spin' : ''}`} />
          {retraining ? 'Retraining…' : 'Retrain Models'}
        </button>
      </div>

      {/* Model Metrics Banner */}
      {compReport?.comparison?.models && (
        <ModelMetricsBanner report={compReport} show={showMetrics} onToggle={() => setShowMetrics(v => !v)} />
      )}

      {/* Input Panel */}
      <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-500" /> Prediction Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
            <select value={routeId} onChange={e => setRouteId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="">Select route…</option>
              {routes.map(r => <option key={r._id} value={r._id}>{r.route_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hour: {hour}:00</label>
            <input type="range" min={0} max={23} value={hour} onChange={e => setHour(Number(e.target.value))}
              className="w-full accent-purple-600 mt-1" />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>12 AM</span><span>12 PM</span><span>11 PM</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            <select value={modelKey} onChange={e => setModelKey(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="auto">🏆 Auto (Best)</option>
              {Object.entries(MODEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {WEATHER_OPTIONS.map(w => {
            const Icon = WEATHER_ICONS[w];
            return (
              <button key={w} onClick={() => setWeather(w)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm capitalize transition ${
                  weather === w ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                }`}>
                <Icon className="w-4 h-4" /> {w}
              </button>
            );
          })}
          <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
            <input type="checkbox" checked={isHoliday} onChange={e => setIsHoliday(e.target.checked)} className="accent-purple-600" />
            <span className="text-sm text-gray-700">Holiday</span>
          </label>
          <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
            <input type="checkbox" checked={special} onChange={e => setSpecial(e.target.checked)} className="accent-purple-600" />
            <span className="text-sm text-gray-700">Special Event</span>
          </label>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={predict} disabled={loading || !routeId}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            {loading ? 'Predicting…' : 'Predict Demand'}
          </button>
          <button onClick={buildDayCurve} disabled={curveLoad || !routeId}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {curveLoad ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {curveLoad ? 'Building…' : 'Build 24h Curve'}
          </button>
          <button onClick={runAllModels} disabled={allLoading || !routeId}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
            {allLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
            {allLoading ? 'Running…' : 'Compare All 6 Models'}
          </button>
        </div>
      </div>

      {/* Prediction Result */}
      {result && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Prediction Result
            </h2>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
              background: MODEL_COLORS[result.model] + '22',
              color: MODEL_COLORS[result.model] ?? '#6366f1',
              border: `1px solid ${MODEL_COLORS[result.model] ?? '#6366f1'}44`,
            }}>
              {result.is_best_model ? '🏆 ' : ''}{MODEL_LABELS[result.model] ?? result.model}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="Predicted Passengers" value={result.predicted_count} color="blue" />
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${CROWD_BG[result.crowd_level] ?? ''}`}>
                {result.crowd_level?.replace('_',' ').toUpperCase()}
              </span>
              <p className="text-xs text-gray-500 mt-2">Crowd Level</p>
            </div>
            <StatCard label="Confidence" value={`${Math.round(result.confidence * 100)}%`} color="green" />
            <StatCard label="Peak Factor" value={`×${(result.peak_factor ?? 1).toFixed(2)}`} color="orange" />
          </div>
          {result.metrics?.mae != null && (
            <div className="grid grid-cols-4 gap-3 pt-3 border-t">
              <MetricPill label="MAE" value={result.metrics.mae?.toFixed(2)} />
              <MetricPill label="RMSE" value={result.metrics.rmse?.toFixed(2)} />
              <MetricPill label="MAPE" value={`${result.metrics.mape?.toFixed(2)}%`} />
              <MetricPill label="R²" value={result.metrics.r2?.toFixed(4)} highlight />
            </div>
          )}
          {result.crowd_level === 'critical' && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Critical demand predicted — dispatch additional buses immediately.
            </div>
          )}
        </div>
      )}

      {/* 24h Demand Curve */}
      {dayCurve.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> 24-Hour Demand Forecast
            <span className="ml-auto text-xs text-gray-400">
              Model: {MODEL_LABELS[modelKey] ?? (modelKey === 'auto' ? 'Best Auto' : modelKey)}
            </span>
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dayCurve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2}
                fill="url(#demandGrad)" name="Predicted Passengers" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All 6 Models Comparison */}
      {allModels && <AllModelsPanel data={allModels} />}

      {/* History Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center justify-between">
          <span>Prediction History</span>
          {history.length > 0 && <span className="text-gray-400 normal-case">{history.length} records</span>}
        </div>
        {history.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">No history — run a prediction to see it here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['Route','Predicted','Actual','Crowd','Model','Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map(row => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{row.route?.route_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-blue-700 font-semibold">{row.predictedCount}</td>
                    <td className="px-4 py-2.5">{row.actualCount ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CROWD_BG[row.crowdLevel] ?? ''}`}>
                        {row.crowdLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{MODEL_LABELS[row.modelUsed ?? ''] ?? row.modelUsed ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(row.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helper tiny components ──────────────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  const bg: Record<string,string> = { blue:'bg-blue-50', green:'bg-green-50', orange:'bg-orange-50', purple:'bg-purple-50' };
  const fg: Record<string,string> = { blue:'text-blue-700', green:'text-green-700', orange:'text-orange-700', purple:'text-purple-700' };
  return (
    <div className={`${bg[color]} rounded-lg p-4 text-center`}>
      <p className={`text-3xl font-bold ${fg[color]}`}>{value}</p>
      <p className={`text-xs mt-1 ${fg[color]} opacity-70`}>{label}</p>
    </div>
  );
}
function MetricPill({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className={`text-center p-2 rounded-lg ${highlight ? 'bg-purple-50' : 'bg-gray-50'}`}>
      <p className={`text-sm font-bold ${highlight ? 'text-purple-700' : 'text-gray-800'}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

/* ── Model Metrics Banner ─────────────────────────────────────────────────────── */
function ModelMetricsBanner({ report, show, onToggle }: {
  report: ComparisonReport; show: boolean; onToggle: () => void;
}) {
  const models = report.comparison?.models ?? {};
  const best = report.best_model ?? '';
  const rows = Object.entries(models).map(([k, v]) => ({
    name: MODEL_LABELS[k] ?? k,
    key: k,
    mae: v.mae ?? 0, rmse: v.rmse ?? 0,
    mape: v.mape ?? 0, r2: v.r2 ?? 0,
    time: v.train_time_sec ?? 0,
    isBest: k === best,
  })).sort((a,b) => a.mae - b.mae);

  const barData = rows.map(r => ({ name: r.name, MAE: +r.mae.toFixed(3), R2: +r.r2.toFixed(4) }));

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
        <span className="font-semibold text-gray-800 flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500" /> Model Performance Comparison
          <span className="text-xs font-normal text-gray-400">({rows.length} models · trained on 490K+ samples)</span>
        </span>
        {show ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {show && (
        <div className="px-5 pb-5 space-y-5 border-t">
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            {rows.map(r => (
              <div key={r.key}
                className={`rounded-xl p-3 border-2 transition ${r.isBest ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: MODEL_COLORS[r.key] }}>{r.name}</span>
                  {r.isBest && <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
                </div>
                <p className="text-lg font-bold text-gray-800">{r.r2.toFixed(4)}</p>
                <p className="text-[10px] text-gray-500">R² score</p>
                <p className="text-xs text-gray-600 mt-1">MAE: {r.mae.toFixed(2)}</p>
                <p className="text-xs text-gray-600">MAPE: {r.mape.toFixed(1)}%</p>
              </div>
            ))}
          </div>

          {/* Bar chart - MAE comparison */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">MAE Comparison (lower = better)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="MAE" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={MODEL_COLORS[rows[i]?.key] ?? '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {['Model','MAE','RMSE','MAPE','R²','Train Time'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className={`border-b ${r.isBest ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2 font-semibold flex items-center gap-1">
                      {r.isBest && '🏆'} {r.name}
                    </td>
                    <td className="px-3 py-2">{r.mae.toFixed(3)}</td>
                    <td className="px-3 py-2">{r.rmse.toFixed(3)}</td>
                    <td className="px-3 py-2">{r.mape.toFixed(2)}%</td>
                    <td className="px-3 py-2 font-semibold text-purple-700">{r.r2.toFixed(4)}</td>
                    <td className="px-3 py-2 text-gray-500">{r.time.toFixed(0)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── All Models Live Comparison Panel ─────────────────────────────────────────── */
function AllModelsPanel({ data }: { data: AllModelsResult }) {
  const entries = Object.entries(data.model_results);
  const chartData = entries.map(([k, v]) => ({
    name: MODEL_LABELS[k] ?? k,
    key: k,
    Predicted: v.predicted_count,
    Confidence: +(v.confidence * 100).toFixed(1),
  }));

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-emerald-500" /> Live All-Model Comparison
        <span className="ml-auto text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
          Best: 🏆 {MODEL_LABELS[data.best_model] ?? data.best_model}
        </span>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {entries.map(([k, v]) => (
          <div key={k}
            className={`rounded-xl p-3 text-center border-2 ${k === data.best_model ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100'}`}>
            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: MODEL_COLORS[k] }} />
            <p className="text-xs font-semibold text-gray-700 mb-1">{MODEL_LABELS[k] ?? k}</p>
            <p className="text-2xl font-bold" style={{ color: MODEL_COLORS[k] }}>{v.predicted_count}</p>
            <p className="text-[10px] text-gray-500">passengers</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block ${CROWD_BG[v.crowd_level] ?? 'bg-gray-100 text-gray-600'}`}>
              {v.crowd_level}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="Predicted" radius={[4,4,0,0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={MODEL_COLORS[entry.key] ?? '#8b5cf6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
