'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Clock, CheckCircle, AlertCircle, TrendingUp, Star,
  Bus, MapPin, ChevronRight, RefreshCw, Trophy,
} from 'lucide-react';

interface Trip {
  _id: string; startTime: string; endTime?: string; status: string;
  stopsCompleted?: number; distanceCovered?: number; avgSpeed?: number;
  route?: { route_name: string }; bus?: { busNumber: string };
  rating?: { overall?: number; comment?: string };
}

function durationStr(start: string, end?: string) {
  if (!end) return 'Ongoing';
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DriverLog() {
  const [trips,   setTrips]   = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({ total: 0, completed: 0, totalKm: 0, avgRating: 0, avgSpeed: 0 });

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const { data } = await api.get('/trips?limit=30&sort=-startTime');
        const trips: Trip[] = data.trips || [];
        setTrips(trips);

        // Compute stats
        const completed = trips.filter(t => t.status === 'completed');
        const totalKm   = completed.reduce((s, t) => s + (t.distanceCovered ?? 0), 0);
        const ratingArr = completed.filter(t => t.rating?.overall).map(t => t.rating!.overall!);
        const avgRating = ratingArr.length ? ratingArr.reduce((s, r) => s + r, 0) / ratingArr.length : 0;
        const speedArr  = completed.filter(t => t.avgSpeed).map(t => t.avgSpeed!);
        const avgSpeed  = speedArr.length ? speedArr.reduce((s, v) => s + v, 0) / speedArr.length : 0;
        setStats({ total: trips.length, completed: completed.length, totalKm: Math.round(totalKm), avgRating: Math.round(avgRating * 10) / 10, avgSpeed: Math.round(avgSpeed) });
      } catch {}
      setLoading(false);
    };
    fetchTrips();
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-800">
        <h1 className="font-black text-white text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" /> Trip History
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Your performance record</p>
      </div>

      {/* Stats Grid */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Total Trips',   value: stats.total,            icon: Bus,       color: 'text-blue-400',   bg: 'bg-blue-500/10' },
          { label: 'Completed',     value: stats.completed,         icon: CheckCircle,color:'text-green-400',  bg: 'bg-green-500/10' },
          { label: 'KM Covered',    value: `${stats.totalKm} km`,   icon: MapPin,    color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Avg Rating',    value: stats.avgRating > 0 ? `⭐ ${stats.avgRating}` : '—', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Avg Speed',     value: stats.avgSpeed > 0 ? `${stats.avgSpeed} km/h` : '—', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Success Rate',  value: stats.total > 0 ? `${Math.round(stats.completed / stats.total * 100)}%` : '—', icon: Trophy, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} border border-slate-700 rounded-2xl p-3.5 flex items-center gap-3`}>
            <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
            <div>
              <p className={`text-lg font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trip list */}
      <div className="px-4 pb-6 space-y-3">
        <h2 className="text-sm font-bold text-white">Recent Trips</h2>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <Bus className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No trips recorded yet</p>
          </div>
        ) : (
          trips.map(trip => (
            <div key={trip._id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  trip.status === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                }`}>
                  {trip.status === 'completed'
                    ? <CheckCircle className="w-5 h-5 text-green-400" />
                    : <AlertCircle className="w-5 h-5 text-yellow-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{trip.route?.route_name ?? 'Route'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(trip.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}{durationStr(trip.startTime, trip.endTime)}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {trip.bus && <span className="text-[10px] text-slate-400">🚌 {trip.bus.busNumber}</span>}
                    {trip.stopsCompleted ? <span className="text-[10px] text-slate-400">🏁 {trip.stopsCompleted} stops</span> : null}
                    {trip.avgSpeed ? <span className="text-[10px] text-slate-400">⚡ {trip.avgSpeed} km/h avg</span> : null}
                    {trip.rating?.overall && (
                      <span className="text-[10px] text-yellow-400">⭐ {trip.rating.overall}/5</span>
                    )}
                  </div>
                  {trip.rating?.comment && (
                    <p className="text-[11px] text-slate-400 mt-1 italic">"{trip.rating.comment}"</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
