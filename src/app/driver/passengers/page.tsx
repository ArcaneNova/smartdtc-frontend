'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Users, Search, Ticket, MapPin, Clock, CheckCircle,
  User, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Bus,
} from 'lucide-react';

interface Booking {
  _id: string; bookingRef: string; passengers: number;
  boardingStop?: string; dropStop?: string; seatPreference?: string;
  status: string; createdAt: string;
  user?: { name: string; phone?: string; email?: string };
  scheduleId?: string;
}
interface Schedule {
  _id: string; departureTime: string; estimatedArrivalTime: string;
  route?: { route_name: string; start_stage: string; end_stage: string };
  bus?: { busNumber: string };
}

export default function DriverPassengers() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selected,  setSelected]  = useState<Schedule | null>(null);
  const [bookings,  setBookings]  = useState<Booking[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [bLoading,  setBLoading]  = useState(false);
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const { data } = await api.get('/mobile/driver/schedule/today');
        setSchedules(data.schedules || []);
        // Auto-select active trip
        const active = data.schedules?.find((s: Schedule) => (s as any).status === 'in-progress');
        if (active) { setSelected(active); fetchBookings(active._id); }
      } catch {}
      setLoading(false);
    };
    fetchSchedules();
  }, []);

  const fetchBookings = async (scheduleId: string) => {
    setBLoading(true);
    try {
      // Fetch bookings for this schedule
      const { data } = await api.get(`/mobile/driver/passengers?scheduleId=${scheduleId}`).catch(async () => {
        // fallback: fetch from booking endpoint
        return api.get(`/bookings?scheduleId=${scheduleId}&limit=100`);
      });
      setBookings(data.bookings || data.passengers || []);
    } catch { setBookings([]); }
    setBLoading(false);
  };

  const selectSchedule = (s: Schedule) => {
    setSelected(s); setBookings([]);
    fetchBookings(s._id);
  };

  const markBoarded = async (bookingId: string) => {
    try {
      await api.patch(`/bookings/${bookingId}`, { status: 'boarded' }).catch(() => {});
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: 'boarded' } : b));
    } catch {}
  };

  const filtered = bookings.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (b.user?.name ?? '').toLowerCase().includes(s) ||
      b.bookingRef.toLowerCase().includes(s) ||
      (b.boardingStop ?? '').toLowerCase().includes(s);
  });

  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const statusColor: Record<string, string> = {
    confirmed: 'bg-blue-500/20 text-blue-400',
    boarded:   'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="flex flex-col min-h-full bg-slate-950 overflow-y-auto">

      {/* Header */}
      <div className="px-4 py-4 sticky top-0 bg-slate-950 z-10 border-b border-slate-800">
        <h1 className="font-black text-white text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> Passenger List
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Booked passengers for your trips</p>
      </div>

      {/* Trip Selector */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-400 mb-2">Select Trip</p>
        {loading ? (
          <div className="h-12 bg-slate-800 rounded-xl animate-pulse" />
        ) : schedules.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />No trips scheduled today
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <button key={s._id} onClick={() => selectSchedule(s)}
                className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-all ${
                  selected?._id === s._id ? 'bg-orange-500/10 border-orange-500/40' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}>
                <Bus className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{s.route?.route_name ?? 'Route'}</p>
                  <p className="text-xs text-slate-400">{timeStr(s.departureTime)} → {timeStr(s.estimatedArrivalTime)}</p>
                </div>
                {selected?._id === s._id && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">Selected</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Search & Stats */}
          <div className="px-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl flex items-center px-3 gap-2">
                <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search passenger, stop, ref…"
                  className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
              <button onClick={() => fetchBookings(selected._id)} className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Summary pills */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total',    value: bookings.length,                                      color: 'text-white' },
                { label: 'Boarded', value: bookings.filter(b => b.status === 'boarded').length,   color: 'text-green-400' },
                { label: 'Pending', value: bookings.filter(b => b.status === 'confirmed').length, color: 'text-blue-400' },
                { label: 'Seats',   value: bookings.reduce((s, b) => s + (b.passengers || 1), 0), color: 'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-center">
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger Cards */}
          <div className="px-4 py-3 space-y-2">
            {bLoading ? (
              <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse"/>)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{bookings.length === 0 ? 'No passengers booked for this trip' : 'No matching passengers'}</p>
              </div>
            ) : (
              filtered.map(b => {
                const isExp = expanded === b._id;
                return (
                  <div key={b._id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                    {/* Main row */}
                    <button className="w-full px-4 py-3 flex items-center gap-3 text-left" onClick={() => setExpanded(isExp ? null : b._id)}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        b.status === 'boarded' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {b.user?.name?.[0]?.toUpperCase() ?? 'P'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{b.user?.name ?? 'Passenger'}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusColor[b.status] ?? 'bg-slate-700 text-slate-400'}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">{b.bookingRef}</span>
                          <span className="text-xs text-slate-500">{b.passengers} seat{(b.passengers ?? 1) > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      {isExp ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {/* Expanded detail */}
                    {isExp && (
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {b.boardingStop && (
                            <div className="bg-slate-700/50 rounded-xl p-2.5">
                              <p className="text-slate-400 mb-0.5">Boarding Stop</p>
                              <p className="font-semibold text-white flex items-center gap-1"><MapPin className="w-3 h-3 text-green-400" />{b.boardingStop}</p>
                            </div>
                          )}
                          {b.dropStop && (
                            <div className="bg-slate-700/50 rounded-xl p-2.5">
                              <p className="text-slate-400 mb-0.5">Drop Stop</p>
                              <p className="font-semibold text-white flex items-center gap-1"><MapPin className="w-3 h-3 text-red-400" />{b.dropStop}</p>
                            </div>
                          )}
                          {b.seatPreference && (
                            <div className="bg-slate-700/50 rounded-xl p-2.5">
                              <p className="text-slate-400 mb-0.5">Seat Pref.</p>
                              <p className="font-semibold text-white capitalize">{b.seatPreference}</p>
                            </div>
                          )}
                          {b.user?.phone && (
                            <div className="bg-slate-700/50 rounded-xl p-2.5">
                              <p className="text-slate-400 mb-0.5">Phone</p>
                              <p className="font-semibold text-white">{b.user.phone}</p>
                            </div>
                          )}
                        </div>

                        {b.status !== 'boarded' && (
                          <button onClick={() => markBoarded(b._id)}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold">
                            <CheckCircle className="w-4 h-4" /> Mark as Boarded
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
