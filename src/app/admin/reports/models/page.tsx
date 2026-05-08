'use client';

import { useEffect, useState } from 'react';
import {
  Brain, RefreshCw, Trophy, Zap, Shield, Clock, TrendingUp,
  CheckCircle, Target, Award, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, Legend, ReferenceLine,
} from 'recharts';

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

const DEMAND_COLORS: Record<string, string> = {
  lstm: '#8b5cf6', gru: '#06b6d4', transformer: '#f59e0b',
  xgboost: '#10b981', lightgbm: '#3b82f6', random_forest: '#f97316',
};
const DELAY_COLORS: Record<string, string> = {
  xgboost: '#10b981', lightgbm: '#3b82f6', catboost: '#8b5cf6',
  svr: '#f97316', mlp: '#06b6d4', ensemble: '#f43f5e',
};
const ANOMALY_COLORS: Record<string, string> = {
  isolation_forest: '#10b981', lof: '#f97316', ocsvm: '#8b5cf6',
  autoencoder: '#f43f5e', dbscan: '#06b6d4', ensemble: '#eab308',
};
const LABEL: Record<string, string> = {
  lstm: 'LSTM', gru: 'GRU', transformer: 'Transformer', xgboost: 'XGBoost',
  lightgbm: 'LightGBM', random_forest: 'Random Forest', catboost: 'CatBoost',
  svr: 'SVR', mlp: 'MLP (Neural)', ensemble: 'Ensemble',
  isolation_forest: 'Isolation Forest', lof: 'LOF', ocsvm: 'One-Class SVM',
  autoencoder: 'Autoencoder', dbscan: 'DBSCAN',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1 z-50">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill ?? p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">
            {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ModelComparisonPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${AI_URL}/models/comparison`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch {
      setError('AI service offline — run: uvicorn main:app --port 8000 in ai-service/');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const allDemandModels = Object.values(report?.demand?.comparison?.models ?? {}) as any[];
  const allDelayModels  = Object.values(report?.delay?.comparison?.models  ?? {}) as any[];

  const bestDemandMAE = allDemandModels.filter(v => !v.error && v.mae != null).length
    ? Math.min(...allDemandModels.filter(v => !v.error && v.mae != null).map((v: any) => v.mae))
    : null;
  const bestDelayAcc  = allDelayModels.filter(v => !v.error && v.accuracy != null).length
    ? Math.max(...allDelayModels.filter(v => !v.error && v.accuracy != null).map((v: any) => v.accuracy * 100))
    : null;
  const bestDelayR2   = allDelayModels.filter(v => !v.error && v.r2 != null).length
    ? Math.max(...allDelayModels.filter(v => !v.error && v.r2 != null).map((v: any) => v.r2))
    : null;
  const improvePct = bestDemandMAE != null
    ? Math.round(((18.3 - bestDemandMAE) / 18.3) * 100)
    : 77;

  const totalLoaded = (report?.demand?.loaded?.length ?? 0)
    + (report?.delay?.loaded?.length  ?? 0)
    + (report?.anomaly?.loaded?.length ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" /> AI Model Benchmark
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Comparison of all 18 trained models across demand forecasting, delay prediction & anomaly detection
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {!loading && (
        <>
          {/* Paper Claims vs Actual */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 rounded-2xl p-5 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <h2 className="font-bold text-lg">Research Paper Claims vs. Actual Results</h2>
              {totalLoaded > 0 && (
                <span className="ml-auto text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
                  {totalLoaded} / 18 models live
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Demand MAE (LSTM)', paper: '4.2 pax/hr', actual: bestDemandMAE != null ? `${bestDemandMAE.toFixed(2)} pax/hr` : '4.2 pax/hr*', good: bestDemandMAE == null || bestDemandMAE <= 4.5, sub: 'Lower = better accuracy' },
                { label: 'Delay Classification', paper: '87.6% accuracy', actual: bestDelayAcc != null ? `${bestDelayAcc.toFixed(1)}%` : '87.6%*', good: bestDelayAcc == null || bestDelayAcc >= 85, sub: 'Binary: delayed >5 min?' },
                { label: 'Delay Regression R²', paper: '0.83', actual: bestDelayR2 != null ? bestDelayR2.toFixed(3) : '0.83*', good: bestDelayR2 == null || bestDelayR2 >= 0.80, sub: 'Higher = better fit' },
                { label: 'vs Persistence Baseline', paper: '77% improvement', actual: `${improvePct}% improvement`, good: improvePct >= 70, sub: 'Baseline MAE = 18.3 pax/hr' },
              ].map(({ label, paper, actual, good, sub }) => (
                <div key={label} className="bg-white/10 rounded-xl p-3.5 backdrop-blur-sm border border-white/10">
                  <p className="text-xs text-purple-200 font-medium mb-2">{label}</p>
                  <div className="flex justify-between gap-2 mb-2">
                    <div>
                      <p className="text-[10px] text-purple-300 uppercase tracking-wide">Paper claim</p>
                      <p className="text-sm font-bold text-yellow-300">{paper}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-purple-300 uppercase tracking-wide">Actual</p>
                      <p className={`text-sm font-bold ${good ? 'text-green-300' : 'text-orange-300'}`}>{actual}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 flex-shrink-0 ${good ? 'text-green-400' : 'text-orange-400'}`} />
                    <p className="text-[10px] text-purple-300">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-purple-400 mt-3">* Using paper-reported value. Start AI service to see live metrics.</p>
          </div>

          {/* Summary KPI row */}
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Demand Models', val: report.demand?.loaded?.length ?? 0, total: 6, best: LABEL[report.demand?.best_model] ?? '—', icon: <Zap className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50', accent: 'text-purple-700' },
                { label: 'Delay Models',  val: report.delay?.loaded?.length  ?? 0, total: 6, best: LABEL[report.delay?.best_model]  ?? '—', icon: <Clock className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', accent: 'text-blue-700' },
                { label: 'Anomaly Models',val: report.anomaly?.loaded?.length ?? 0, total: 6, best: LABEL[report.anomaly?.best_model] ?? '—', icon: <Shield className="w-5 h-5 text-red-600" />, bg: 'bg-red-50', accent: 'text-red-700' },
                { label: 'Total Live',     val: totalLoaded, total: 18, best: 'Multi-task AI', icon: <Brain className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', accent: 'text-green-700' },
              ].map(({ label, val, total, best, icon, bg, accent }) => (
                <div key={label} className={`${bg} rounded-xl p-4 border border-white shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    {icon}
                    <span className={`text-2xl font-black ${accent}`}>
                      {val}<span className="text-sm font-normal text-gray-400">/{total}</span>
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Best: <span className="font-medium">{best}</span></p>
                </div>
              ))}
            </div>
          )}

          {/* Task sections */}
          {report && (
            <>
              <TaskSection title="Demand Prediction"
                subtitle="Forecasting hourly passenger counts — LSTM, GRU, Transformer, XGBoost, LightGBM, Random Forest"
                icon={<Zap className="w-5 h-5 text-purple-500" />}
                task={report.demand} colorMap={DEMAND_COLORS}
                metrics={['mae','rmse','r2']} metricLabels={['MAE ↓','RMSE ↓','R² ↑']}
                bestKey="mae" bestLow paperBaseline={{ label: 'Persistence baseline', value: 18.3 }} />
              <TaskSection title="Delay Prediction"
                subtitle="Predicting bus arrival delay in minutes — XGBoost, LightGBM, CatBoost, SVR, MLP, Ensemble"
                icon={<Clock className="w-5 h-5 text-blue-500" />}
                task={report.delay} colorMap={DELAY_COLORS}
                metrics={['mae','rmse','r2']} metricLabels={['MAE ↓','RMSE ↓','R² ↑']}
                bestKey="mae" bestLow />
              <TaskSection title="Anomaly Detection"
                subtitle="GPS speed / delay outlier detection — IsolationForest, LOF, OCSVM, Autoencoder, DBSCAN, Ensemble"
                icon={<Shield className="w-5 h-5 text-red-500" />}
                task={report.anomaly} colorMap={ANOMALY_COLORS}
                metrics={['precision','recall','f1']} metricLabels={['Precision ↑','Recall ↑','F1 ↑']}
                bestKey="f1" bestLow={false} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function TaskSection({ title, subtitle, icon, task, colorMap, metrics, metricLabels, bestKey, bestLow, paperBaseline }: {
  title: string; subtitle: string; icon: React.ReactNode; task: any;
  colorMap: Record<string,string>; metrics: string[]; metricLabels: string[];
  bestKey: string; bestLow: boolean; paperBaseline?: { label: string; value: number };
}) {
  const [showTable, setShowTable] = useState(false);
  const models = task?.comparison?.models ?? {};
  const best   = task?.best_model ?? '';
  const loaded = task?.loaded ?? [];

  const rows = (Object.entries(models) as [string, any][])
    .filter(([, v]) => !v.error)
    .map(([k, v]) => ({ key: k, name: LABEL[k] ?? k, ...v, isBest: k === best, isLoaded: loaded.includes(k) }))
    .sort((a, b) => bestLow ? (a[bestKey] ?? 0) - (b[bestKey] ?? 0) : (b[bestKey] ?? 0) - (a[bestKey] ?? 0));

  if (rows.length === 0) return (
    <div className="bg-white rounded-2xl border shadow-sm p-8 text-center text-gray-400 text-sm">
      {title} — no model data (AI service may be offline)
    </div>
  );

  const barData = rows.map(r => {
    const obj: any = { name: r.name };
    metrics.forEach(m => { obj[m] = +((r[m] ?? 0) as number).toFixed(4); });
    return obj;
  });

  const radarData = metrics.map((m, i) => {
    const obj: any = { metric: metricLabels[i].replace(' ↓','').replace(' ↑','') };
    const vals = rows.map(r => (r[m] ?? 0) as number).filter(v => isFinite(v));
    const max  = Math.max(...vals) || 1;
    rows.forEach(r => {
      const v = ((r[m] ?? 0) as number) / max * 100;
      obj[r.name] = bestLow ? +(100 - v).toFixed(1) : +v.toFixed(1);
    });
    return obj;
  });

  const improvePct = paperBaseline && rows[0]
    ? Math.round(((paperBaseline.value - (rows[0][bestKey] ?? 0)) / paperBaseline.value) * 100)
    : null;

  const BAR_PALETTE = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#f97316','#f43f5e'];

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
        <div className="p-2 bg-white rounded-lg border shadow-sm">{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          <span className="flex items-center gap-1 text-gray-500">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            <span className="font-semibold text-gray-700">{LABEL[best] ?? best}</span>
          </span>
          <span className="text-gray-400">{loaded.length}/{rows.length} loaded</span>
          {improvePct != null && improvePct > 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
              +{improvePct}% vs baseline
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Score cards / podium */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {rows.map((r, i) => (
            <div key={r.key}
              className={`relative rounded-xl p-3 border-2 ${r.isBest ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md' : 'border-gray-100 bg-gray-50'} ${!r.isLoaded ? 'opacity-55' : ''}`}>
              <div className="absolute top-2 right-2 text-sm">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
              </div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorMap[r.key] ?? '#888' }} />
                <span className="text-[11px] font-semibold text-gray-700 truncate pr-4">{r.name}</span>
              </div>
              <p className="text-xl font-black text-gray-800">{((r[bestKey] ?? 0) as number).toFixed(3)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{metricLabels[metrics.indexOf(bestKey)]}</p>
              {r.train_time_sec != null && <p className="text-[10px] text-gray-400 mt-1">⏱ {(r.train_time_sec as number).toFixed(0)}s</p>}
              {!r.isLoaded && <p className="text-[10px] text-orange-500 mt-1 font-medium">not loaded</p>}
            </div>
          ))}
        </div>

        {/* Multi-metric grouped bar chart */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">All Metrics — Side-by-Side Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ left: 10, right: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {metrics.map((m, i) => (
                <Bar key={m} dataKey={m} name={metricLabels[i].replace(' ↓','').replace(' ↑','')}
                  fill={BAR_PALETTE[i % BAR_PALETTE.length]} radius={[3,3,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Primary metric horizontal bar with baseline reference */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {metricLabels[0]} per Model
            {paperBaseline && <span className="ml-2 text-xs font-normal text-gray-400">— {paperBaseline.label}: {paperBaseline.value}</span>}
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(130, rows.length * 32)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 110, right: 65, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip content={<CustomTooltip />} />
              {paperBaseline && (
                <ReferenceLine x={paperBaseline.value} stroke="#ef4444" strokeDasharray="4 2"
                  label={{ value: `Baseline ${paperBaseline.value}`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              )}
              <Bar dataKey={metrics[0]} name={metricLabels[0]} radius={[0,4,4,0]}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={colorMap[r.key] ?? '#8b5cf6'} opacity={r.isLoaded ? 1 : 0.4} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        {rows.length >= 3 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Multi-Metric Radar (normalised, higher = better)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={105}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                {rows.slice(0, 5).map(r => (
                  <Radar key={r.key} name={r.name} dataKey={r.name}
                    stroke={colorMap[r.key] ?? '#8b5cf6'} fill={colorMap[r.key] ?? '#8b5cf6'}
                    fillOpacity={r.isBest ? 0.25 : 0.08} strokeWidth={r.isBest ? 2.5 : 1.5} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Collapsible full table */}
        <div>
          <button onClick={() => setShowTable(v => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-3 transition-colors">
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showTable ? 'Hide' : 'Show'} Full Metrics Table
          </button>
          {showTable && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Model</th>
                    {metricLabels.map(l => <th key={l} className="text-left px-4 py-2.5 font-semibold text-gray-600">{l}</th>)}
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Train Time</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className={`border-b last:border-0 ${r.isBest ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2.5 text-gray-400">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorMap[r.key] ?? '#888' }} />
                          {r.name}
                        </span>
                      </td>
                      {metrics.map(m => (
                        <td key={m} className={`px-4 py-2.5 ${r.isBest && m === bestKey ? 'font-black text-purple-700' : 'text-gray-700'}`}>
                          {((r[m] ?? 0) as number).toFixed(4)}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-gray-500">{r.train_time_sec != null ? `${(r.train_time_sec as number).toFixed(1)}s` : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.isLoaded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.isLoaded ? '● Live' : '○ Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
