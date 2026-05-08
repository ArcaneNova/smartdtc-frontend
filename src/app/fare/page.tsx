'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Zap, Bus, MapPin, ArrowRight, ArrowLeftRight, Loader2, Info,
  ChevronDown, ChevronUp, X, CheckCircle2, Users, Clock,
  Wallet, CalendarDays, TrendingDown, Navigation, Copy,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stage {
  _id: string;
  stage_name: string;
  seq: number;
  location?: { type: string; coordinates: [number, number] }; // [lng, lat]
}
interface FareResult {
  amount: number;
  currency: string;
  busType: string;
  distanceKm: number;
  from: string;
  to: string;
  slabInfo: string;
  concessionsAvailable: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BUS_TYPES = [
  { key: 'non-AC',   label: 'Non-AC',   emoji: '🚌', desc: 'Standard DTC' },
  { key: 'AC',       label: 'AC Bus',   emoji: '❄️', desc: 'Air conditioned' },
  { key: 'electric', label: 'Electric', emoji: '⚡', desc: 'Eco-friendly EV' },
];

const SLABS = [
  { range: 'Up to 2 km',  nonAC: 10, AC: 15, electric: 10 },
  { range: 'Up to 5 km',  nonAC: 15, AC: 20, electric: 15 },
  { range: 'Up to 10 km', nonAC: 20, AC: 30, electric: 20 },
  { range: 'Up to 15 km', nonAC: 25, AC: 40, electric: 25 },
  { range: 'Up to 20 km', nonAC: 30, AC: 50, electric: 30 },
  { range: 'Up to 25 km', nonAC: 35, AC: 60, electric: 35 },
  { range: 'Up to 30 km', nonAC: 40, AC: 70, electric: 40 },
  { range: 'Up to 40 km', nonAC: 50, AC: 85, electric: 50 },
  { range: 'Above 40 km', nonAC: 60, AC: 100, electric: 60 },
];

// ── Lazy map (no SSR) ─────────────────────────────────────────────────────────
interface FareMapProps {
  fromCoords: [number, number] | null;
  toCoords:   [number, number] | null;
  fromName:   string;
  toName:     string;
}

const FareMap = dynamic<FareMapProps>(() => import('@/components/map/FareMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  ),
});

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FareCalculatorPage() {
  const apiBase = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/v1`;

  // form state
  const [fromQuery,    setFromQuery]    = useState('');
  const [toQuery,      setToQuery]      = useState('');
  const [busType,      setBusType]      = useState('non-AC');
  const [passengers,   setPassengers]   = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<FareResult | null>(null);
  const [error,        setError]        = useState('');
  const [showConcessions, setShowConcessions] = useState(false);
  const [copied,       setCopied]       = useState(false);

  // stop picker state
  const [fromSuggestions, setFromSuggestions] = useState<Stage[]>([]);
  const [toSuggestions,   setToSuggestions]   = useState<Stage[]>([]);
  const [fromSelected,    setFromSelected]    = useState<Stage | null>(null);
  const [toSelected,      setToSelected]      = useState<Stage | null>(null);
  const [allStages,       setAllStages]       = useState<Stage[]>([]);
  const [showFromModal,   setShowFromModal]   = useState(false);
  const [showToModal,     setShowToModal]     = useState(false);
  const [fromModalSearch, setFromModalSearch] = useState('');
  const [toModalSearch,   setToModalSearch]   = useState('');
  const [stagesLoading,   setStagesLoading]   = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const searchStages = async (q: string, setList: (s: Stage[]) => void) => {
    if (q.length < 2) { setList([]); return; }
    try {
      const r = await fetch(`${apiBase}/stages/search?name=${encodeURIComponent(q)}&limit=20`);
      const d = await r.json();
      setList(d.stages ?? []);
    } catch { setList([]); }
  };

  const fetchAllStages = useCallback(async () => {
    if (allStages.length > 0) return;
    setStagesLoading(true);
    try {
      const r = await fetch(`${apiBase}/stages/all?limit=5000`);
      const d = await r.json();
      const stages: Stage[] = d.stages || [];
      const unique = Array.from(new Map(stages.map(s => [s.stage_name, s])).values()) as Stage[];
      unique.sort((a, b) => a.stage_name.localeCompare(b.stage_name));
      setAllStages(unique);
    } catch { /* silent */ }
    finally { setStagesLoading(false); }
  }, [apiBase, allStages.length]);

  const filteredStages = (search: string) => {
    if (!search.trim()) return allStages;
    const q = search.toLowerCase();
    return allStages.filter(s => s.stage_name.toLowerCase().includes(q));
  };

  useEffect(() => {
    const t = setTimeout(() => searchStages(fromQuery, setFromSuggestions), 300);
    return () => clearTimeout(t);
  }, [fromQuery]);
  useEffect(() => {
    const t = setTimeout(() => searchStages(toQuery, setToSuggestions), 300);
    return () => clearTimeout(t);
  }, [toQuery]);

  // ── swap ─────────────────────────────────────────────────────────────────────
  const swap = () => {
    const tmpQ = fromQuery; setFromQuery(toQuery); setToQuery(tmpQ);
    const tmpS = fromSelected; setFromSelected(toSelected); setToSelected(tmpS);
    setResult(null);
  };

  // ── calculate ─────────────────────────────────────────────────────────────────
  const calculate = async () => {
    if (!fromQuery.trim() || !toQuery.trim()) {
      setError('Please select both origin and destination stops.');
      return;
    }
    setError(''); setLoading(true); setResult(null);
    try {
      const params = new URLSearchParams({
        fromStage: fromSelected?.stage_name || fromQuery,
        toStage:   toSelected?.stage_name   || toQuery,
        busType,
      });
      const r = await fetch(`${apiBase}/public/fare?${params}`);
      const d = await r.json();
      if (d.success) setResult(d.fare);
      else setError(d.message || 'Could not calculate fare.');
    } catch {
      setError('Service unavailable — please try again.');
    } finally { setLoading(false); }
  };

  // ── copy ──────────────────────────────────────────────────────────────────────
  const copyResult = () => {
    if (!result) return;
    const text = `🚌 DTC Fare: ₹${result.amount * passengers}\nFrom: ${result.from}\nTo: ${result.to}\nDistance: ${result.distanceKm} km · Bus: ${result.busType}${passengers > 1 ? `\nPassengers: ${passengers}` : ''}\n\nvia SmartDTC Fare Calculator`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── derived ───────────────────────────────────────────────────────────────────
  const totalFare  = result ? result.amount * passengers : 0;
  const travelMins = result ? Math.round((result.distanceKm / 20) * 60) : 0;
  const monthlySpend = result ? result.amount * 44 : 0; // 22 days × 2 trips

  const fromCoords = fromSelected?.location?.coordinates
    ? [fromSelected.location.coordinates[1], fromSelected.location.coordinates[0]] as [number, number]
    : null;
  const toCoords = toSelected?.location?.coordinates
    ? [toSelected.location.coordinates[1], toSelected.location.coordinates[0]] as [number, number]
    : null;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      {/* NAV */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <Bus className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SmartDTC</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <Link href="/track" className="hover:text-blue-600 transition">Track Buses</Link>
            <Link href="/search" className="hover:text-blue-600 transition">Routes</Link>
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
            <Zap className="w-3 h-3" /> DTC Official Fare Slabs
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Bus Fare Calculator</h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            Calculate exact DTC bus fare, estimate travel time, split costs for groups, and preview your journey on a map.
          </p>
        </div>

        {/* TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT — CALCULATOR (3 cols) */}
          <div className="lg:col-span-3 space-y-5">

            {/* CALCULATOR CARD */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">

              {/* FROM / SWAP / TO */}
              <div className="space-y-2 mb-5">

                {/* FROM */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    <MapPin className="w-3 h-3 inline mr-1 text-green-500" />From Stop
                  </label>
                  <div className="relative">
                    <input
                      value={fromQuery}
                      onChange={e => { setFromQuery(e.target.value); setFromSelected(null); setResult(null); }}
                      onBlur={() => setTimeout(() => setFromSuggestions([]), 150)}
                      placeholder="e.g. ISBT Kashmere Gate"
                      className={`w-full border rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                        fromSelected ? 'border-green-400 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {fromSelected && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <button type="button"
                        onClick={() => { setShowFromModal(true); fetchAllStages(); setFromModalSearch(''); }}
                        className="text-gray-400 hover:text-blue-600 transition" title="Browse all stops">
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                    {fromSuggestions.length > 0 && !fromSelected && (
                      <ul className="absolute z-20 top-full left-0 right-0 bg-white border rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                        {fromSuggestions.map(s => (
                          <li key={s._id}
                            onMouseDown={e => { e.preventDefault(); setFromQuery(s.stage_name); setFromSelected(s); setFromSuggestions([]); }}
                            className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            {s.stage_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* SWAP */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <button onClick={swap}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition font-medium">
                    <ArrowLeftRight className="w-3.5 h-3.5" /> Swap
                  </button>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>

                {/* TO */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    <MapPin className="w-3 h-3 inline mr-1 text-red-500" />To Stop
                  </label>
                  <div className="relative">
                    <input
                      value={toQuery}
                      onChange={e => { setToQuery(e.target.value); setToSelected(null); setResult(null); }}
                      onBlur={() => setTimeout(() => setToSuggestions([]), 150)}
                      placeholder="e.g. Dwarka Sector 21"
                      className={`w-full border rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                        toSelected ? 'border-green-400 bg-green-50' : 'border-gray-300'
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {toSelected && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      <button type="button"
                        onClick={() => { setShowToModal(true); fetchAllStages(); setToModalSearch(''); }}
                        className="text-gray-400 hover:text-blue-600 transition" title="Browse all stops">
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                    {toSuggestions.length > 0 && !toSelected && (
                      <ul className="absolute z-20 top-full left-0 right-0 bg-white border rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                        {toSuggestions.map(s => (
                          <li key={s._id}
                            onMouseDown={e => { e.preventDefault(); setToQuery(s.stage_name); setToSelected(s); setToSuggestions([]); }}
                            className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            {s.stage_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* BUS TYPE + PASSENGERS */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bus Type</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {BUS_TYPES.map(bt => (
                      <button key={bt.key} onClick={() => { setBusType(bt.key); setResult(null); }}
                        className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all text-center ${
                          busType === bt.key ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <span className="text-base">{bt.emoji}</span>
                        <span className="text-xs font-semibold text-gray-800 leading-tight">{bt.label}</span>
                        <span className="text-[10px] text-gray-400">{bt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <Users className="w-3 h-3 inline mr-1" />Passengers
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setPassengers(p => Math.max(1, p - 1))}
                      className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition select-none">−</button>
                    <span className="flex-1 text-center text-2xl font-bold text-gray-800">{passengers}</span>
                    <button onClick={() => setPassengers(p => Math.min(20, p + 1))}
                      className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition select-none">+</button>
                  </div>
                  <p className="text-[11px] text-gray-400 text-center mt-1">for group / family trips</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <button onClick={calculate} disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-3.5 rounded-xl font-semibold text-base transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {loading ? 'Calculating…' : 'Calculate Fare'}
              </button>
            </div>

            {/* RESULT CARD */}
            {result && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* Gradient header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-200 text-xs mb-1">
                        {passengers > 1 ? `${passengers} passengers · ₹${result.amount} each` : 'Single passenger'}
                      </p>
                      <p className="text-5xl font-extrabold tracking-tight">₹{totalFare}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full block">
                        {result.busType} · {result.slabInfo}
                      </span>
                      <button onClick={copyResult}
                        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-lg transition ml-auto">
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Journey route */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">From</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{result.from || fromQuery}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs text-gray-400 mb-0.5">To</p>
                      <p className="font-semibold text-gray-800 text-sm truncate">{result.to || toQuery}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <Navigation className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-700">{result.distanceKm} km</p>
                      <p className="text-xs text-blue-400">Distance</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-amber-700">~{travelMins} min</p>
                      <p className="text-xs text-amber-400">Est. time</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <Wallet className="w-4 h-4 text-green-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-700">₹{totalFare}</p>
                      <p className="text-xs text-green-400">Total fare</p>
                    </div>
                  </div>

                  {/* Bus type comparison */}
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      All bus types {passengers > 1 ? `(×${passengers} passengers)` : ''}
                    </div>
                    {BUS_TYPES.map(bt => {
                      const perPerson = bt.key === 'AC'
                        ? result.amount + 15
                        : bt.key === 'non-AC'
                        ? (result.busType === 'non-AC' ? result.amount : result.amount - 5)
                        : result.amount;
                      const isActive = bt.key === result.busType;
                      return (
                        <div key={bt.key}
                          className={`flex items-center justify-between px-4 py-3 border-t first:border-t-0 ${isActive ? 'bg-blue-50' : ''}`}>
                          <span className="text-sm text-gray-700 flex items-center gap-2">{bt.emoji} {bt.label}</span>
                          <span className={`font-semibold text-sm ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>
                            ₹{perPerson * passengers} {isActive && <span className="text-green-500">✓</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Monthly commute estimate */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarDays className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-800">Monthly Commute Estimate</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <p className="text-xs text-purple-400 mb-0.5">Daily (×2)</p>
                        <p className="font-bold text-purple-800">₹{result.amount * 2 * passengers}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-400 mb-0.5">Weekly (×10)</p>
                        <p className="font-bold text-purple-800">₹{result.amount * 10 * passengers}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-400 mb-0.5">Monthly (×44)</p>
                        <p className="font-bold text-purple-800">₹{monthlySpend * passengers}</p>
                      </div>
                    </div>
                    {monthlySpend * passengers > 500 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-purple-700 bg-purple-100 rounded-lg px-3 py-2">
                        <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
                        DTC Monthly Pass (~₹500) could save you <strong>₹{monthlySpend * passengers - 500}</strong> per month!
                      </div>
                    )}
                  </div>

                  {/* Concessions */}
                  {result.concessionsAvailable?.length > 0 && (
                    <>
                      <button onClick={() => setShowConcessions(v => !v)}
                        className="w-full flex items-center justify-between text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition">
                        <span className="font-medium">🎫 Concession discounts available</span>
                        {showConcessions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {showConcessions && (
                        <ul className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5 -mt-2">
                          {result.concessionsAvailable.map(c => (
                            <li key={c} className="text-sm text-amber-800 flex items-center gap-2">
                              <span className="text-amber-500">✓</span> {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  <p className="text-xs text-gray-400 text-center">
                    Based on official DTC distance slabs. Actual fare may vary slightly by route.
                  </p>
                </div>
              </div>
            )}

            {/* FARE REFERENCE TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-sm font-bold text-gray-800">DTC Fare Slab Reference</h2>
                <p className="text-xs text-gray-400 mt-0.5">Official distance-based fares for all bus types</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Distance', 'Non-AC 🚌', 'AC ❄️', 'Electric ⚡'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {SLABS.map(row => (
                      <tr key={row.range} className="hover:bg-blue-50/40 transition">
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{row.range}</td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">₹{row.nonAC}</td>
                        <td className="px-4 py-2.5 font-semibold text-cyan-700">₹{row.AC}</td>
                        <td className="px-4 py-2.5 font-semibold text-green-700">₹{row.electric}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT — MAP (2 cols) */}
          <div className="lg:col-span-2 space-y-5">

            {/* MAP CARD — sticky on desktop */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden lg:sticky lg:top-20">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">Journey Map</span>
                <span className="ml-auto text-xs text-gray-400">
                  {fromSelected && toSelected ? '📍 Route preview' : 'Select stops to preview'}
                </span>
              </div>

              <div className="h-[380px]">
                <FareMap
                  fromCoords={fromCoords}
                  toCoords={toCoords}
                  fromName={fromQuery}
                  toName={toQuery}
                />
              </div>

              {(fromSelected || toSelected) && (
                <div className="px-4 py-3 bg-gray-50 border-t space-y-1.5 text-xs text-gray-600">
                  {fromSelected && (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="font-medium">From:</span>
                      <span className="truncate">{fromSelected.stage_name}</span>
                    </div>
                  )}
                  {toSelected && (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="font-medium">To:</span>
                      <span className="truncate">{toSelected.stage_name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TIPS CARD */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">💡 How to use</h3>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  Type a stop name to search, or click <strong>🔍</strong> to browse all stops
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  Use <strong>Swap</strong> to instantly reverse your journey direction
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  Increase <strong>Passengers</strong> to calculate group fares in one click
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  The map shows both stops as pins once selected
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  <strong>Monthly estimate</strong> helps compare with DTC monthly pass (₹500+)
                </li>
              </ul>
            </div>

            {/* CONCESSION GUIDE */}
            <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">🎫 Concession Guide</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Senior Citizens (60+)', disc: '50% off', color: 'text-orange-600 bg-orange-50' },
                  { label: 'Students (with ID)', disc: '25% off', color: 'text-blue-600 bg-blue-50' },
                  { label: 'Differently-abled', disc: 'Free', color: 'text-green-600 bg-green-50' },
                  { label: 'Women (Pink Line buses)', disc: 'Free', color: 'text-pink-600 bg-pink-50' },
                ].map(c => (
                  <div key={c.label} className="flex items-center justify-between">
                    <span className="text-gray-600">{c.label}</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${c.color}`}>{c.disc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FROM STOP MODAL */}
      {showFromModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowFromModal(false)}>
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">Select From Stop</h2>
                {allStages.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{allStages.length} stops available</p>}
              </div>
              <button onClick={() => setShowFromModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="px-6 py-3 border-b bg-gray-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={fromModalSearch} onChange={e => setFromModalSearch(e.target.value)}
                  placeholder="Search stops…" autoFocus
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {stagesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500">Loading stops…</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStages(fromModalSearch).map(s => (
                    <button key={s._id}
                      onClick={() => { setFromQuery(s.stage_name); setFromSelected(s); setShowFromModal(false); setFromSuggestions([]); setResult(null); }}
                      className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-blue-50 transition text-left">
                      <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.stage_name}</p>
                        <p className="text-xs text-gray-400">Stop #{s.seq}</p>
                      </div>
                    </button>
                  ))}
                  {filteredStages(fromModalSearch).length === 0 && (
                    <div className="px-6 py-10 text-center text-gray-400 text-sm">
                      {fromModalSearch ? `No stops matching "${fromModalSearch}"` : 'No stops available'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TO STOP MODAL */}
      {showToModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowToModal(false)}>
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-900">Select To Stop</h2>
                {allStages.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{allStages.length} stops available</p>}
              </div>
              <button onClick={() => setShowToModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="px-6 py-3 border-b bg-gray-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={toModalSearch} onChange={e => setToModalSearch(e.target.value)}
                  placeholder="Search stops…" autoFocus
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {stagesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500">Loading stops…</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStages(toModalSearch).map(s => (
                    <button key={s._id}
                      onClick={() => { setToQuery(s.stage_name); setToSelected(s); setShowToModal(false); setToSuggestions([]); setResult(null); }}
                      className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-blue-50 transition text-left">
                      <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.stage_name}</p>
                        <p className="text-xs text-gray-400">Stop #{s.seq}</p>
                      </div>
                    </button>
                  ))}
                  {filteredStages(toModalSearch).length === 0 && (
                    <div className="px-6 py-10 text-center text-gray-400 text-sm">
                      {toModalSearch ? `No stops matching "${toModalSearch}"` : 'No stops available'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
