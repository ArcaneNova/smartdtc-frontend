'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { connectSocket } from '@/lib/socket';
import Link from 'next/link';
import {
  Bus, MapPin, Clock, Zap, TrendingUp, CheckCircle,
  AlertTriangle, RefreshCw, Navigation, Play, Square,
  Users, ChevronRight, Shield, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DriverData {
  _id: string; status: string; licenseNo: string; rating: number; experience: number;
  assignedBus?: { _id: string; busNumber: string; model: string; type: string; capacity: number };
}
interface Schedule {
  _id: string; departureTime: string; estimatedArrivalTime: string;
  status: string; type: string;
  route?: { _id: string; route_name: string; start_stage: string; end_stage: string };
  bus?: { busNumber: string };
}
interface AnomalyResult { is_anomaly: boolean; reason: string; confidence: number; model: string; }

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000';

export default function DriverDashboard() {
  const { user }            = useAuthStore();
  const [driver,   setDriver]   = useState<DriverData | null>(null);
  const [schedules,setSchedules]= useState<Schedule[]>([]);
  const [current,  setCurrent]  = useState<Schedule | null>(null);
  const [tripId,   setTripId]   = useState<string | null>(null);
  const [anomaly,  setAnomaly]  = useState<AnomalyResult | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [speed,    setSpeed]    = useState(0);
  const [delay,    setDelay]    = useState(0);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, schedRes] = await Promise.all([
        api.get('/mobile/driver/dashboard'),
        api.get('/mobile/driver/schedule/today'),
      ]);
      setDriver(dashRes.data.driver);
      setSchedules(schedRes.data.schedules || []);
      setCurrent(schedRes.data.current || null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // GPS + Anomaly detection
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(async pos => {
      const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : speed;
      setSpeed(spd);
      // Send position to backend
      if (current) {
        const busId = driver?.assignedBus?._id;
        if (busId) {
          await api.post('/tracking/update', {
            busId, lat: pos.coords.latitude, lng: pos.coords.longitude, speed: spd,
          }).catch(() => {});
        }
      }
      // Anomaly check every 30s
      if (spd > 0 || delay > 0) {
        try {
          const res = await fetch(`${AI_URL}/detect/anomaly`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed_kmh: spd, delay_minutes: delay, passenger_load: 60, model_key: 'auto' }),
          });
          const d: AnomalyResult = await res.json();
          setAnomaly(d);
          if (d.is_anomaly) toast.error(`⚠️ Anomaly: ${d.reason}`, { duration: 5000 });
        } catch {}
      }
    }, () => {}, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(id);
  }, [current, driver, speed, delay]);

  const startTrip = async (scheduleId: string) => {
    try {
      const { data } = await api.post('/mobile/driver/trip/start', { scheduleId });
      setTripId(data.trip._id);
      setCurrent(schedules.find(s => s._id === scheduleId) ?? null);
      await api.patch('/mobile/driver/status', { status: 'on-duty' });
      fetchDashboard();
      toast.success('🚌 Trip started! Drive safe.');
    } catch { toast.error('Failed to start trip'); }
  };

  const endTrip = async () => {
    if (!tripId) return;
    try {
      await api.post('/mobile/driver/trip/end', {
        tripId, stopsCompleted: 0, distanceCovered: 0, avgSpeed: speed,
      });
      setTripId(null); setCurrent(null);
      fetchDashboard();
      toast.success('✅ Trip ended! Good work.');
    } catch { toast.error('Failed to end trip'); }
  };

  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading…
    </div>
  );

  return (
    <div className="flex flex-col min-h-full overflow-y-auto px-4 py-4 space-y-4">

      {/* Welcome */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border border-slate-700">
        <p className="text-slate-400 text-sm">Good {new Date().getHours() < 12 ? 'morning' : 'evening'},</p>
        <h1 className="text-xl font-black mt-0.5">{user?.name?.split(' ')[0] ?? 'Driver'} 👋</h1>
        <div className="flex items-center gap-3 mt-3">
          {driver?.assignedBus && (
            <div className="flex items-center gap-2 bg-slate-700 rounded-xl px-3 py-2">
              <Bus className="w-4 h-4 text-orange-400" />
              <div>
                <p className="text-xs font-bold text-white">{driver.assignedBus.busNumber}</p>
                <p className="text-[10px] text-slate-400">{driver.assignedBus.type} · {driver.assignedBus.capacity} seats</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-700 rounded-xl px-3 py-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <div>
              <p className="text-xs font-bold text-white">{driver?.rating?.toFixed(1) ?? '—'}</p>
              <p className="text-[10px] text-slate-400">Rating</p>
            </div>
          </div>
          <div className={`ml-auto text-xs px-2 py-1 rounded-full font-bold ${
            driver?.status === 'on-duty' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
          }`}>
            {driver?.status ?? 'off-duty'}
          </div>
        </div>
      </div>

      {/* Anomaly Alert */}
      {anomaly?.is_anomaly && (
        <div className="bg-red-950/80 border border-red-500/50 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300 text-sm">⚠️ Anomaly Detected</p>
            <p className="text-xs text-red-400 mt-0.5">{anomaly.reason}</p>
            <p className="text-[10px] text-red-600 mt-1">Model: {anomaly.model} · {Math.round(anomaly.confidence * 100)}% confidence</p>
          </div>
        </div>
      )}

      {/* Active Trip */}
      {current ? (
        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-orange-300">Active Trip</span>
          </div>
          <p className="font-black text-white text-lg">{current.route?.route_name ?? 'Route'}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <MapPin className="w-3 h-3" />{current.route?.start_stage}
            <ChevronRight className="w-3 h-3" />
            <MapPin className="w-3 h-3" />{current.route?.end_stage}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-slate-800 rounded-xl p-2.5 text-center">
              <p className="text-lg font-black text-blue-400">{speed}</p>
              <p className="text-[10px] text-slate-400">km/h</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-2.5 text-center">
              <p className={`text-lg font-black ${delay > 5 ? 'text-red-400' : 'text-green-400'}`}>{delay > 0 ? `+${delay}` : '0'}</p>
              <p className="text-[10px] text-slate-400">min delay</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-2.5 text-center">
              <Shield className={`w-5 h-5 mx-auto ${anomaly?.is_anomaly ? 'text-red-400' : 'text-green-400'}`} />
              <p className="text-[10px] text-slate-400">AI Shield</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Link href="/driver/passengers"
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold">
              <Users className="w-4 h-4" /> Passengers
            </Link>
            <button onClick={endTrip}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl text-sm font-bold">
              <Square className="w-4 h-4" /> End Trip
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-center">
          <Navigation className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No active trip</p>
          <p className="text-xs text-slate-500 mt-0.5">Start a scheduled trip below</p>
        </div>
      )}

      {/* Today's Schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" /> Today's Schedule
          </h2>
          <button onClick={fetchDashboard}><RefreshCw className="w-3.5 h-3.5 text-slate-500" /></button>
        </div>
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No trips scheduled today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => {
              const isActive = s._id === current?._id;
              const isDone   = s.status === 'completed';
              return (
                <div key={s._id} className={`rounded-2xl border p-4 transition-all ${
                  isActive ? 'bg-orange-500/10 border-orange-500/40' :
                  isDone   ? 'bg-slate-800/30 border-slate-700/50 opacity-60' :
                  'bg-slate-800/50 border-slate-700'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isActive ? 'bg-orange-500/20' : isDone ? 'bg-slate-700' : 'bg-slate-700'
                    }`}>
                      {isDone ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Bus className="w-4 h-4 text-orange-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{s.route?.route_name ?? 'Route'}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeStr(s.departureTime)} → {timeStr(s.estimatedArrivalTime)}
                      </p>
                    </div>
                    {!isActive && !isDone && s.status !== 'cancelled' && (
                      <button onClick={() => startTrip(s._id)}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition">
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                    {isActive && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-bold">ACTIVE</span>
                    )}
                    {isDone && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">DONE</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link href="/driver/passengers" className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <Users className="w-6 h-6 text-blue-400 mb-2" />
          <p className="font-bold text-white text-sm">Passengers</p>
          <p className="text-[11px] text-slate-400">View bookings</p>
        </Link>
        <Link href="/driver/log" className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <TrendingUp className="w-6 h-6 text-purple-400 mb-2" />
          <p className="font-bold text-white text-sm">Trip History</p>
          <p className="text-[11px] text-slate-400">Past trips & stats</p>
        </Link>
      </div>
    </div>
  );
}
