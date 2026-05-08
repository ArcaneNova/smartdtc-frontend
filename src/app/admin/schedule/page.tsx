'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Schedule } from '@/types';
import { Calendar, Plus, RefreshCw, Sparkles, X, ChevronDown, ChevronUp, Clock, Zap, Edit2, Trash2, Users, AlertTriangle, CloudRain, Sun, Wind, Thermometer, Snowflake } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const statusColor: Record<string, string> = {
  scheduled:    'blue',
  'in-progress':'yellow',
  completed:    'green',
  cancelled:    'red',
};

interface AISlot {
  departureTime?: string;
  estimatedArrivalTime?: string;
  departure_time_str?: string;
  arrival_time_str?: string;
  departure_min?: number;
  duration_min?: number;
  demand_score: number;
  crowd_level: string;
  bus_number?: number;
  trip_number?: number;
  headway_min?: number;
  direction?: 'outbound' | 'return';
}

interface RouteOpt { _id: string; route_name: string; }
interface BusOpt   { _id: string; busNumber: string; }
interface DriverOpt { _id: string; userId: { name: string }; }

const EMPTY_FORM = {
  routeId: '', busId: '', driverId: '',
  date: new Date().toISOString().split('T')[0],
  departureTime: '06:00', estimatedArrivalTime: '07:30',
  type: 'regular', status: 'scheduled',
};

const normalizeAIBusSlot = (date: string, slot: AISlot) => {
  const baseDate = new Date(date);
  const departureIso = slot.departureTime
    || (slot.departure_time_str
      ? (() => {
          const [hours, minutes] = slot.departure_time_str.split(':').map(Number);
          const d = new Date(baseDate);
          d.setHours(hours || 0, minutes || 0, 0, 0);
          return d.toISOString();
        })()
      : slot.departure_min != null
        ? (() => {
            const d = new Date(baseDate);
            d.setHours(0, 0, 0, 0);
            d.setMinutes(slot.departure_min || 0);
            return d.toISOString();
          })()
        : baseDate.toISOString());

  const arrivalIso = slot.estimatedArrivalTime
    || (() => {
      const d = new Date(departureIso);
      d.setMinutes(d.getMinutes() + (slot.duration_min ?? 90));
      return d.toISOString();
    })();

  return {
    ...slot,
    departureTime: departureIso,
    estimatedArrivalTime: arrivalIso,
  };
};

export default function SchedulePage() {
  const [schedules,      setSchedules]      = useState<Schedule[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [date,           setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [showAIPanel,    setShowAIPanel]    = useState(false);
  const [aiRouteId,      setAIRouteId]      = useState('');
  const [aiBuses,        setAIBuses]        = useState(3);
  const [aiLoading,      setAILoading]      = useState(false);
  const [aiSlots,        setAISlots]        = useState<AISlot[]>([]);
  const [applyLoading,   setApplyLoading]   = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult,     setBulkResult]     = useState<{done: number; total: number} | null>(null);
  const [routes,         setRoutes]         = useState<RouteOpt[]>([]);
  const [buses,          setBuses]          = useState<BusOpt[]>([]);
  const [drivers,        setDrivers]        = useState<DriverOpt[]>([]);
  const [showModal,      setShowModal]      = useState(false);
  const [editSched,      setEditSched]      = useState<Schedule | null>(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [saving,         setSaving]         = useState(false);
  const [aiModelInfo,    setAiModelInfo]    = useState<{model?: string; count?: number} | null>(null);
  const [bookedSeats,    setBookedSeats]    = useState<Record<string, number>>({});
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [routeFilter,    setRouteFilter]    = useState('');
  // AI generation options
  const [aiWeather,      setAiWeather]      = useState('clear');
  const [aiDayType,      setAiDayType]      = useState<'weekday'|'weekend'|'holiday'>('weekday');
  const [aiHourMode,     setAiHourMode]     = useState<'whole_day'|'custom'|'peak_hour_all'>('whole_day');
  const [aiStartHour,    setAiStartHour]    = useState(5);
  const [aiEndHour,      setAiEndHour]      = useState(23);
  const [aiBulkHour,     setAiBulkHour]     = useState(8);
  const [aiTripDuration, setAiTripDuration] = useState(90);   // minutes — overrides auto from distance_km
  const [aiTurnaround,   setAiTurnaround]   = useState(15);   // terminus layover minutes
  const [fleetInfo,      setFleetInfo]      = useState<{
    total_trips: number; cycle_time_min: number; min_headway_min: number;
    trips_per_bus: number[]; trip_duration_min: number;
    recommendations?: {
      buses_for_headway: Record<string, number>;
      demand_optimal_headway_min: number;
      demand_optimal_buses: number;
      peak_demand_per_hour: number;
      avg_demand_per_hour: number;
      note: string;
    };
  } | null>(null);


  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/schedule?date=${date}&limit=50`);
      const scheds: Schedule[] = data.schedules || [];
      setSchedules(scheds);
      // Fetch booked seat counts per schedule in parallel
      const counts: Record<string, number> = {};
      await Promise.all(scheds.map(async (s) => {
        try {
          const bRes = await api.get(`/mobile/passenger/bookings?scheduleId=${s._id}&limit=200`);
          const active = (bRes.data.bookings || []).filter((b: {status:string}) => ['confirmed','boarded'].includes(b.status));
          counts[s._id] = active.reduce((acc: number, b: {passengers:number}) => acc + (b.passengers || 1), 0);
        } catch { counts[s._id] = 0; }
      }));
      setBookedSeats(counts);
    } catch { toast.error('Failed to load schedules'); }
    finally { setLoading(false); }
  };

  const fetchRoutes = async () => {
    try {
      const { data } = await api.get('/routes?limit=50');
      setRoutes(data.routes || []);
    } catch {}
  };

  const fetchFormOptions = async () => {
    try {
      const [rRes, bRes, dRes] = await Promise.all([
        api.get('/routes?limit=100'),
        api.get('/buses?limit=50'),
        api.get('/drivers?limit=50'),
      ]);
      setRoutes(rRes.data.routes || []);
      setBuses(bRes.data.buses || []);
      setDrivers(dRes.data.drivers || []);
    } catch {}
  };

  const openCreate = () => {
    setEditSched(null);
    setForm({ ...EMPTY_FORM, date });
    fetchFormOptions();
    setShowModal(true);
  };

  // Auto-recalculate estimated arrival when departure changes (keeps same duration)
  const handleDepartureChange = (newDep: string) => {
    const [dh, dm] = form.departureTime.split(':').map(Number);
    const [ah, am] = form.estimatedArrivalTime.split(':').map(Number);
    const durationMin = (ah * 60 + am) - (dh * 60 + dm);
    const [nh, nm] = newDep.split(':').map(Number);
    const arrivalMin = nh * 60 + nm + (durationMin > 0 ? durationMin : 90);
    const arrH = Math.floor(arrivalMin / 60) % 24;
    const arrM = arrivalMin % 60;
    setForm(f => ({
      ...f,
      departureTime: newDep,
      estimatedArrivalTime: `${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}`,
    }));
  };

  const openEdit = (s: Schedule) => {
    setEditSched(s);
    setForm({
      routeId:              (s.route as any)?._id || '',
      busId:                (s.bus as any)?._id   || '',
      driverId:             (s.driver as any)?._id || '',
      date:                 s.date?.split('T')[0] || date,
      departureTime:        s.departureTime ? new Date(s.departureTime).toTimeString().slice(0, 5) : '06:00',
      estimatedArrivalTime: s.estimatedArrivalTime ? new Date(s.estimatedArrivalTime).toTimeString().slice(0, 5) : '07:30',
      type:                 s.type   || 'regular',
      status:               s.status || 'scheduled',
    });
    fetchFormOptions();
    setShowModal(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const makeDate = (dateStr: string, timeStr: string) => {
        const d = new Date(dateStr);
        const [h, m] = timeStr.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const payload = {
        route:                form.routeId,
        bus:                  form.busId,
        driver:               form.driverId,
        date:                 new Date(form.date).toISOString(),
        departureTime:        makeDate(form.date, form.departureTime),
        estimatedArrivalTime: makeDate(form.date, form.estimatedArrivalTime),
        type:                 form.type,
        status:               form.status,
      };
      if (editSched) {
        await api.put(`/schedule/${editSched._id}`, payload);
        toast.success('Schedule updated');
      } else {
        await api.post('/schedule', payload);
        toast.success('Schedule created');
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await api.delete(`/schedule/${id}`);
      toast.success('Schedule deleted');
      fetchSchedules();
    } catch { toast.error('Failed to delete'); }
  };

  const quickStatus = async (id: string, status: string) => {
    setStatusUpdating(id);
    try {
      await api.put(`/schedule/${id}`, { status });
      setSchedules(prev => prev.map(s => s._id === id ? { ...s, status: status as Schedule['status'] } : s));
      toast.success(`Status updated to ${status}`);
    } catch { toast.error('Failed to update status'); }
    finally { setStatusUpdating(null); }
  };

  useEffect(() => { fetchSchedules(); setRouteFilter(''); }, [date]);
  useEffect(() => { fetchRoutes(); }, []); // load routes for filter on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (showAIPanel) fetchRoutes(); }, [showAIPanel]);

  const filteredSchedules = routeFilter
    ? schedules.filter(s => ((s.route as any)?._id || (s.route as any)) === routeFilter)
    : schedules;

  const generateAISchedule = async () => {
    if (!aiRouteId) { toast.error('Select a route first'); return; }
    setAILoading(true);
    setAISlots([]);
    setAiModelInfo(null);
    const isWeekend = aiDayType === 'weekend';
    const isHoliday = aiDayType === 'holiday';
    const startH = aiHourMode === 'whole_day' ? 5 : aiStartHour;
    const endH   = aiHourMode === 'whole_day' ? 23 : aiEndHour;
    try {
      const { data } = await api.post('/schedule/generate-ai', {
        date,
        routeIds: [aiRouteId],
        totalBusesAvailable: aiBuses,
        weather:           aiWeather,
        is_holiday:        isHoliday,
        is_weekend:        isWeekend,
        start_hour:        startH,
        end_hour:          endH,
        trip_duration_min: aiTripDuration,
        turnaround_min:    aiTurnaround,
      });
      const normalized = (data.slots || []).map((slot: AISlot) => normalizeAIBusSlot(date, slot));
      setAISlots(normalized);
      if (data.total_trips) {
        setFleetInfo({
          total_trips:       data.total_trips,
          cycle_time_min:    data.cycle_time_min,
          min_headway_min:   data.min_headway_min,
          trips_per_bus:     data.trips_per_bus ?? [],
          trip_duration_min: data.trip_duration_min ?? aiTripDuration,
          recommendations:   data.recommendations ?? undefined,
        });
      }
      if (data.schedules?.[0]?.demand_model || data.demand_model) {
        setAiModelInfo({ model: data.schedules?.[0]?.demand_model ?? data.demand_model });
      }
      toast.success(`Generated ${normalized.length} trips across ${aiBuses} buses`);
    } catch {
      toast.error('AI generation failed — check AI service is running');
    } finally {
      setAILoading(false);
    }
  };

  const bulkGenerateAll = async () => {
    let allRoutes = routes;
    if (!allRoutes.length) {
      try { allRoutes = (await api.get('/routes?limit=100')).data.routes ?? []; }
      catch { allRoutes = []; }
    }
    if (!allRoutes.length) { toast.error('No routes found'); return; }
    setBulkGenerating(true);
    setBulkResult(null);
    const isWeekend = aiDayType === 'weekend';
    const isHoliday = aiDayType === 'holiday';
    // For peak_hour_all mode: generate 1-hour window for ALL routes at specified hour
    const startH = aiHourMode === 'peak_hour_all' ? aiBulkHour : aiHourMode === 'custom' ? aiStartHour : 5;
    const endH   = aiHourMode === 'peak_hour_all' ? aiBulkHour + 1 : aiHourMode === 'custom' ? aiEndHour : 23;
    const targets = aiHourMode === 'peak_hour_all' ? allRoutes : allRoutes.slice(0, 20);
    let done = 0;
    for (const route of targets) {
      try {
        const { data } = await api.post('/schedule/generate-ai', {
          date, routeIds: [route._id], totalBusesAvailable: aiBuses,
          weather: aiWeather, is_holiday: isHoliday, is_weekend: isWeekend,
          start_hour: startH, end_hour: endH,
          trip_duration_min: aiTripDuration, turnaround_min: aiTurnaround,
        });
        const normalizedSlots = (data.slots || []).map((slot: AISlot) => normalizeAIBusSlot(date, slot));
        if (normalizedSlots.length) {
          await api.post('/schedule/generate-ai/apply', {
            date, routeId: route._id, slots: normalizedSlots,
          });
          done++;
        }
      } catch {}
    }
    setBulkResult({ done, total: targets.length });
    setBulkGenerating(false);
    fetchSchedules();
    toast.success(`Bulk AI schedule: ${done}/${targets.length} routes scheduled`);
  };



  const applyAISchedule = async () => {
    if (!aiSlots.length || !aiRouteId) return;
    // Warn if schedules already exist for this route+date
    const existing = schedules.filter(s => ((s.route as any)?._id || (s.route as any)) === aiRouteId);
    if (existing.length > 0) {
      if (!confirm(`⚠️ ${existing.length} schedule(s) already exist for this route on ${date}. Apply anyway? This may create duplicates.`)) return;
    }
    setApplyLoading(true);
    try {
      const { data } = await api.post('/schedule/generate-ai/apply', {
        date,
        routeId: aiRouteId,
        slots: aiSlots,
      });
      if (data.errors > 0) {
        toast.success(`Saved ${data.count}/${aiSlots.length} trips (${data.errors} skipped)`);
      } else {
        toast.success(`✅ All ${data.count} trips saved to database!`);
      }
      setAISlots([]);
      setFleetInfo(null);
      setShowAIPanel(false);
      fetchSchedules();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply schedule');
    } finally {
      setApplyLoading(false);
    }
  };

  const crowdColor: Record<string, string> = {
    low: 'green', medium: 'yellow', high: 'orange', very_high: 'red',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Schedule</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {routes.length > 0 && (
            <select
              value={routeFilter}
              onChange={e => setRouteFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
            >
              <option value="">All routes</option>
              {routes.map(r => <option key={r._id} value={r._id}>{r.route_name}</option>)}
            </select>
          )}
          <button onClick={fetchSchedules} className="p-2 text-gray-500 hover:text-blue-600">
            <RefreshCw className="w-4 h-4" />
          </button>
          {/* AI Generate button */}
          <button
            onClick={() => setShowAIPanel((v) => !v)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate AI Schedule
            {showAIPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Trip
          </button>
        </div>
      </div>

      {/* AI Schedule Panel */}
      {showAIPanel && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-purple-900">AI Schedule Generator</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {aiModelInfo?.model ? `Demand: ${aiModelInfo.model.toUpperCase()}` : 'Multi-Model'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkGenerateAll}
                disabled={bulkGenerating}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {bulkGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {bulkGenerating ? 'Generating all…' : aiHourMode === 'peak_hour_all' ? `⚡ All Routes @ ${String(aiBulkHour).padStart(2,'0')}:00` : '⚡ All Routes'}
              </button>
              <button onClick={() => { setShowAIPanel(false); setAISlots([]); setBulkResult(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {bulkResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium">
                Bulk AI schedule complete: <strong>{bulkResult.done}/{bulkResult.total}</strong> routes scheduled for {date}
              </span>
            </div>
          )}

          {/* ── Row 1: Route + Buses + Trip Duration + Turnaround + Generate ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
              <select
                value={aiRouteId}
                onChange={(e) => { setAIRouteId(e.target.value); setFleetInfo(null); setAISlots([]); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select route…</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>{r.route_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buses</label>
              <input
                type="number" min={1} max={50}
                value={aiBuses}
                onChange={(e) => setAIBuses(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="One-way trip time in minutes">
                Trip Duration
                <span className="ml-1 text-xs text-gray-400 font-normal">(min)</span>
              </label>
              <input
                type="number" min={10} max={360}
                value={aiTripDuration}
                onChange={(e) => setAiTripDuration(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" title="Layover at terminus before next trip">
                Turnaround
                <span className="ml-1 text-xs text-gray-400 font-normal">(min)</span>
              </label>
              <input
                type="number" min={0} max={60}
                value={aiTurnaround}
                onChange={(e) => setAiTurnaround(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* ── Cycle stats hint ── */}
          <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Round-trip cycle = {2 * aiTripDuration + aiTurnaround} min
              <span className="text-purple-400"> (2×{aiTripDuration} + {aiTurnaround} layover)</span>
              &nbsp;·&nbsp;
              Headway = <strong>{Math.ceil((2 * aiTripDuration + aiTurnaround) / aiBuses)} min</strong> &nbsp;·&nbsp;
              ~<strong>{aiBuses * Math.max(1, Math.floor(((aiHourMode === 'whole_day' ? 18 : aiEndHour - aiStartHour) * 60) / (2 * aiTripDuration + aiTurnaround))) * 2}</strong> total trips/day (↗+↩)
            </span>
            <button
              onClick={generateAISchedule}
              disabled={aiLoading || !aiRouteId}
              className="ml-auto flex items-center gap-1.5 bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50"
            >
              {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {aiLoading ? 'Generating…' : 'Generate Schedule'}
            </button>
          </div>

          {/* ── Row 2: Weather + Holiday + Hour mode ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/60 rounded-xl p-3 border border-purple-100">
            {/* Weather */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                🌤 Weather
              </label>
              <select
                value={aiWeather}
                onChange={e => setAiWeather(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                <option value="clear">☀️ Clear</option>
                <option value="cloudy">⛅ Cloudy</option>
                <option value="fog">🌫 Fog</option>
                <option value="rain">🌧 Rain</option>
                <option value="heavy_rain">⛈ Heavy Rain</option>
                <option value="heatwave">🥵 Heatwave</option>
                <option value="extreme">🌪 Extreme</option>
              </select>
            </div>

            {/* Day Type toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                🗓 Day Type
              </label>
              <div className="flex gap-1.5">
                {([
                  { key: 'weekday', emoji: '💼', label: 'Weekday', active: 'bg-blue-600 text-white border-blue-600' },
                  { key: 'weekend', emoji: '🏖', label: 'Weekend', active: 'bg-purple-500 text-white border-purple-500' },
                  { key: 'holiday', emoji: '🎉', label: 'Holiday', active: 'bg-orange-500 text-white border-orange-500' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAiDayType(opt.key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                      aiDayType === opt.key
                        ? opt.active
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour mode */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                🕐 Hour Range
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { key: 'whole_day',     label: '🌅 Whole Day (5–23h)' },
                  { key: 'custom',        label: '⏱ Custom Range' },
                  { key: 'peak_hour_all', label: '⚡ 1 Hour → All Routes' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAiHourMode(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap ${
                      aiHourMode === opt.key
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Row 3: Conditional hour inputs ── */}
          {aiHourMode === 'custom' && (
            <div className="flex items-center gap-4 bg-white/60 rounded-xl p-3 border border-purple-100">
              <Clock className="w-4 h-4 text-purple-500 shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium whitespace-nowrap">From</label>
                <input
                  type="number" min={0} max={22}
                  value={aiStartHour}
                  onChange={e => setAiStartHour(Math.min(Number(e.target.value), aiEndHour - 1))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-gray-400 text-sm">:00</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 font-medium whitespace-nowrap">To</label>
                <input
                  type="number" min={1} max={23}
                  value={aiEndHour}
                  onChange={e => setAiEndHour(Math.max(Number(e.target.value), aiStartHour + 1))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <span className="text-gray-400 text-sm">:00</span>
              </div>
              <span className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded-lg">
                {aiEndHour - aiStartHour}h window · ~{aiBuses} buses
              </span>
            </div>
          )}

          {aiHourMode === 'peak_hour_all' && (
            <div className="flex items-center gap-4 bg-amber-50 rounded-xl p-3 border border-amber-200">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium whitespace-nowrap">Target hour</label>
                <input
                  type="number" min={0} max={23}
                  value={aiBulkHour}
                  onChange={e => setAiBulkHour(Number(e.target.value))}
                  className="w-16 border border-amber-300 rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-gray-500 text-sm">:00 – {String(aiBulkHour + 1).padStart(2,'0')}:00</span>
              </div>
              <span className="text-xs text-amber-700 font-medium bg-amber-100 px-2 py-1 rounded-lg">
                Generates 1-hour slot for <strong>all {routes.length || '?'} routes</strong>
              </span>
              <button
                onClick={bulkGenerateAll}
                disabled={bulkGenerating}
                className="ml-auto flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {bulkGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {bulkGenerating ? 'Running…' : `Apply to All Routes`}
              </button>
            </div>
          )}

          {/* Generated slots */}
          {aiSlots.length > 0 && (
            <div className="space-y-3">
              {/* Fleet summary banner */}
              {fleetInfo && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-white rounded-xl border border-purple-100 p-3">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Trips</p>
                    <p className="text-lg font-bold text-purple-700">{fleetInfo.total_trips}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Buses</p>
                    <p className="text-lg font-bold text-blue-700">{fleetInfo.trips_per_bus.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Min Headway</p>
                    <p className="text-lg font-bold text-green-700">{fleetInfo.min_headway_min} min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cycle Time</p>
                    <p className="text-lg font-bold text-gray-700">{fleetInfo.cycle_time_min} min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Trips/Bus</p>
                    <p className="text-lg font-bold text-orange-600">
                      {fleetInfo.trips_per_bus.length > 0 ? Math.max(...fleetInfo.trips_per_bus) : '—'}
                    </p>
                  </div>
                  <div className="md:col-span-5 mt-1 flex flex-wrap gap-1.5">
                    {fleetInfo.trips_per_bus.map((count, i) => (
                      <span key={i} className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        🚌 Bus {i+1}: {count} trips
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations panel */}
              {fleetInfo?.recommendations && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-amber-600 font-semibold text-sm">🚌 Fleet Size Recommendations</span>
                    <span className="text-xs text-amber-500">based on {fleetInfo.recommendations.peak_demand_per_hour} pax/hr peak</span>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5 mb-2">
                    {Object.entries(fleetInfo.recommendations.buses_for_headway).map(([key, buses]) => {
                      const headwayMin = parseInt(key);
                      const isOptimal = headwayMin === fleetInfo.recommendations!.demand_optimal_headway_min;
                      const isCurrent = buses === aiBuses;
                      return (
                        <button
                          key={key}
                          onClick={() => setAIBuses(buses)}
                          className={`flex flex-col items-center p-1.5 rounded-lg border text-xs transition ${
                            isOptimal
                              ? 'border-amber-500 bg-amber-100 font-bold text-amber-800'
                              : isCurrent
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300'
                          }`}
                        >
                          <span className="font-bold text-sm">{buses}</span>
                          <span className="text-[10px] text-gray-500">{headwayMin}-min</span>
                          {isOptimal && <span className="text-[9px] text-amber-600 mt-0.5">★ optimal</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-amber-700 italic">{fleetInfo.recommendations.note}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{aiSlots.length} trips for {date}</p>
                  {aiModelInfo?.model && (
                    <p className="text-xs text-purple-600 mt-0.5">Demand model: 🏆 {aiModelInfo.model.toUpperCase()}</p>
                  )}
                </div>
                <button
                  onClick={applyAISchedule}
                  disabled={applyLoading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {applyLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  ✅ Apply to Database
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto">
                {aiSlots.map((slot, idx) => {
                  const cc = crowdColor[slot.crowd_level] || 'gray';
                  const busColors = ['blue','purple','green','orange','pink','indigo','teal','red','yellow','cyan'];
                  const busColor  = slot.bus_number ? busColors[(slot.bus_number - 1) % busColors.length] : 'gray';
                  return (
                    <div key={idx} className={`bg-white rounded-lg border-l-4 border-${busColor}-400 border border-gray-100 px-3 py-2 text-xs`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-bold text-gray-700">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {new Date(slot.departureTime || date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {slot.bus_number != null && (
                          <span className={`bg-${busColor}-100 text-${busColor}-700 px-1.5 py-0.5 rounded font-bold`}>
                            B{slot.bus_number}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400">
                        {slot.direction === 'return' ? '↩' : '→'}{' '}
                        {new Date(slot.estimatedArrivalTime || slot.departureTime || date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {slot.trip_number != null && (
                        <p className="text-gray-400 mt-0.5">
                          {slot.direction === 'return'
                            ? <span className="text-indigo-400">↩ Return #{slot.trip_number}</span>
                            : `Trip #${slot.trip_number}`}
                        </p>
                      )}
                      {slot.headway_min != null && slot.headway_min > 0 && (
                        <p className="text-gray-400">+{slot.headway_min}min gap</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className={`px-1.5 py-0.5 rounded bg-${cc}-100 text-${cc}-700 capitalize`}>
                          {slot.crowd_level?.replace('_', ' ')}
                        </span>
                        {slot.demand_score != null && (
                          <span className="text-purple-600 font-semibold">📊 {slot.demand_score}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading schedules…</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3" />
            <p className="font-medium">No schedules for {date}</p>
            <p className="text-sm mt-1">Click <strong>Add Trip</strong> or use <strong>Generate AI Schedule</strong></p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-6 px-5 py-3 bg-gray-50 border-b text-xs text-gray-500">
              <span className="font-semibold text-gray-700 text-sm">
                {filteredSchedules.length}{routeFilter && filteredSchedules.length !== schedules.length ? ` / ${schedules.length}` : ''} trips
              </span>
              {(['scheduled','in-progress','completed','cancelled'] as const).map(st => {
                const count = filteredSchedules.filter(s => s.status === st).length;
                if (!count) return null;
                const colors: Record<string, string> = { scheduled:'blue', 'in-progress':'yellow', completed:'green', cancelled:'red' };
                const c = colors[st] || 'gray';
                return (
                  <span key={st} className={`flex items-center gap-1 bg-${c}-100 text-${c}-700 px-2 py-0.5 rounded-full font-medium capitalize`}>
                    {count} {st}
                  </span>
                );
              })}
              <span className="ml-auto">
                Total booked: <strong>{Object.values(bookedSeats).reduce((a,b) => a+b, 0)} seats</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Route', 'Bus', 'Driver', 'Departure', 'Arrival', 'Type', 'Occupancy', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSchedules.map((s) => {
                    const color = statusColor[s.status] || 'gray';
                    const capacity = (s.bus as any)?.capacity ?? 0;
                    const booked = bookedSeats[s._id] ?? 0;
                    const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
                    const isUpdating = statusUpdating === s._id;
                    return (
                      <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-48">
                          <p className="truncate">{(s.route as any)?.route_name ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-700">{(s.bus as any)?.busNumber ?? '—'}</p>
                          {(s.bus as any)?.type && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              (s.bus as any).type === 'AC' ? 'bg-blue-100 text-blue-700' :
                              (s.bus as any).type === 'electric' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{(s.bus as any).type}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-32">
                          <p className="truncate">{(s.driver?.userId as any)?.name || '—'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatDate(s.departureTime, { timeStyle: 'short' })}</td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatDate(s.estimatedArrivalTime, { timeStyle: 'short' })}</td>
                        <td className="px-4 py-3 capitalize">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.type === 'peak' ? 'bg-orange-100 text-orange-700' :
                            s.type === 'express' ? 'bg-purple-100 text-purple-700' :
                            s.type === 'emergency' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{s.type}</span>
                        </td>
                        <td className="px-4 py-3 min-w-[120px]">
                          {capacity > 0 ? (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{booked}/{capacity}</span>
                                {pct >= 90 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                {pct >= 70 && pct < 90 && <span className="text-[10px] text-orange-500 font-medium">Near full</span>}
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Users className="w-3 h-3" />{booked} booked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={s.status}
                            disabled={isUpdating}
                            onChange={e => quickStatus(s._id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium capitalize cursor-pointer focus:outline-none ${
                              s.status === 'scheduled'    ? 'bg-blue-50 border-blue-200 text-blue-700' :
                              s.status === 'in-progress'  ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                              s.status === 'completed'    ? 'bg-green-50 border-green-200 text-green-700' :
                              'bg-red-50 border-red-200 text-red-700'
                            }`}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteSchedule(s._id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">{editSched ? 'Edit Schedule' : 'Create Schedule'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
                <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select route…</option>
                  {routes.map((r) => <option key={r._id} value={r._id}>{r.route_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bus *</label>
                  <select value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select bus…</option>
                    {buses.map((b) => <option key={b._id} value={b._id}>{b.busNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
                  <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select driver…</option>
                    {drivers.map((d) => <option key={d._id} value={d._id}>{(d.userId as any)?.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time *</label>
                  <input type="time" value={form.departureTime} onChange={(e) => handleDepartureChange(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Est. Arrival *
                    {form.departureTime && form.estimatedArrivalTime && (() => {
                      const [dh,dm] = form.departureTime.split(':').map(Number);
                      const [ah,am] = form.estimatedArrivalTime.split(':').map(Number);
                      const dur = (ah*60+am)-(dh*60+dm);
                      return dur > 0 ? <span className="ml-1 text-xs text-gray-400 font-normal">{dur} min trip</span> : null;
                    })()}
                  </label>
                  <input type="time" value={form.estimatedArrivalTime} onChange={(e) => setForm({ ...form, estimatedArrivalTime: e.target.value })} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="regular">Regular</option>
                    <option value="peak">Peak</option>
                    <option value="express">Express</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="scheduled">Scheduled</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : editSched ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
