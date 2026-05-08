'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { connectSocket } from '@/lib/socket';
import {
  MapPin, Bell, ChevronRight, Navigation,
  Search, Zap, Bus, TrendingUp, Heart, AlertTriangle, RefreshCw,
  BarChart2, Star, Ticket, X, User, Clock, QrCode,
} from 'lucide-react';

interface NearbyBus {
  bus: string; busNumber?: string; routeName?: string;
  delay_minutes: number; speed: number;
  nextStage?: { stage_name: string };
  location: { coordinates: [number, number] };
  distanceKm?: number;
}

interface Alert { _id: string; type: string; severity: string; message: string; createdAt: string; }
interface FavRoute { _id: string; label?: string; type: string; }
interface Ticket {
  _id: string;
  bookingRef: string;
  busNumber?: string;
  busType?: string;
  toStop: string;
  dropStop?: string;
  seatNumbers: string[];
  passengers: number;
  status: string;
  fare: number;
  expiresAt?: string;
  createdAt: string;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function PassengerHome() {
  const { user } = useAuthStore();
  const [nearby, setNearby]       = useState<NearbyBus[]>([]);
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [favs,   setFavs]         = useState<FavRoute[]>([]);
  const [loading, setLoading]     = useState(true);
  const [alarms, setAlarms]       = useState<Record<string, boolean>>({});
  const [userLoc, setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [busRes, alertRes, favRes, ticketRes] = await Promise.all([
        api.get('/tracking/live'),
        api.get('/alerts?limit=5&severity=critical,warning'),
        api.get('/mobile/passenger/favourites').catch(() => ({ data: { favourites: [] } })),
        api.get('/mobile/passenger/bookings?limit=10').catch(() => ({ data: { bookings: [] } })),
      ]);
      setTickets(ticketRes.data.bookings || []);

      const positions: NearbyBus[] = busRes.data.positions || [];
      if (userLoc) {
        positions.forEach(b => {
          const [lng, lat] = b.location?.coordinates || [0, 0];
          const d = Math.sqrt((lat - userLoc.lat) ** 2 + (lng - userLoc.lng) ** 2) * 111;
          b.distanceKm = Math.round(d * 10) / 10;
        });
        positions.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
      }
      setNearby(positions.slice(0, 5));
      setAlerts(alertRes.data.alerts || []);
      setFavs(favRes.data.favourites || []);
    } catch {}
    setLoading(false);
  }, [userLoc]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('bus:location_update', (pos: NearbyBus) => {
      setNearby(prev => {
        const idx = prev.findIndex(b => b.bus === pos.bus);
        if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], ...pos }; return n; }
        return prev;
      });
      if (alarms[pos.bus] && (pos.delay_minutes ?? 0) <= 1) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🚌 Bus ${pos.busNumber ?? ''} is arriving!`, { body: `Next stop: ${pos.nextStage?.stage_name}` });
        }
      }
    });
    return () => { socket.off('bus:location_update'); };
  }, [alarms]);

  const toggleAlarm = (busId: string) => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    setAlarms(prev => ({ ...prev, [busId]: !prev[busId] }));
  };

  const hour = new Date().getHours();
  const crowdLabel = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 'Peak Hours' : hour >= 22 || hour <= 5 ? 'Off-Peak' : 'Moderate';
  const activeBuses = nearby.filter(b => (b.speed ?? 0) > 0).length;
  const critAlerts  = alerts.filter(a => a.severity === 'critical').length;

  const getExpiry = (t: Ticket) => {
    if (!t.expiresAt) return null;
    return Math.max(0, Math.round((new Date(t.expiresAt).getTime() - Date.now()) / 60000));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ─── WELCOME HERO ─── */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-6 w-40 h-40 bg-white/5 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-orange-200 text-sm">Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'},</p>
            <h1 className="text-3xl font-extrabold mt-1">{user?.name?.split(' ')[0] ?? 'Traveller'} 👋</h1>
            <p className="text-orange-200 text-sm mt-2">
              {activeBuses} buses active ·{' '}
              <span className={`font-semibold ${(hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 'text-red-300' : 'text-green-300'}`}>
                {crowdLabel}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { href: '/passenger/map',    label: '🗺️ Live Map'        },
              { href: '/passenger/search', label: '🔍 Search Routes'   },
              { href: '/fare',             label: '💰 Fare Calculator'  },
              { href: '/passenger/alerts', label: '🚨 Alerts'           },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="bg-white/15 hover:bg-white/25 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SCAN-TO-BOARD CTA ─── */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center gap-5">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
          <QrCode className="w-9 h-9" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-extrabold">Scan & Board — No Pre-booking Needed!</h2>
          <p className="text-orange-100 text-sm mt-1">
            Just scan the QR code on the bus gate → select your drop stop → confirm your seat. Pay the conductor on board.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
          <Link href="/how-to-board"
            className="bg-white text-orange-600 font-bold px-6 py-3 rounded-xl text-center text-sm hover:bg-orange-50 transition-colors">
            How It Works
          </Link>
          <p className="text-xs text-orange-200 text-center">Use your phone camera on the bus</p>
        </div>
      </div>

      {/* ─── CRITICAL ALERT BANNER ─── */}
      {critAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-800">{critAlerts} Critical Alert{critAlerts > 1 ? 's' : ''}</p>
            <p className="text-sm text-red-600 truncate">{alerts.find(a => a.severity === 'critical')?.message}</p>
          </div>
          <Link href="/passenger/alerts" className="text-sm font-semibold text-red-600 hover:text-red-800 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ─── STATS ROW ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bus}           label="Active Buses"    value={activeBuses}  sub="right now"     color="bg-orange-500" />
        <StatCard icon={AlertTriangle} label="Critical Alerts" value={critAlerts}   sub="active"        color="bg-red-500" />
        <StatCard icon={Heart}         label="Saved Routes"    value={favs.length}  sub="in favourites" color="bg-pink-500" />
        <StatCard icon={BarChart2}     label="Demand Level"    value={crowdLabel}                       color="bg-indigo-500" />
      </div>

      {/* ─── MAIN TWO-COLUMN ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT — Live Buses */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Bus className="w-5 h-5 text-orange-500" /> Nearby Live Buses
            </h2>
            <button onClick={fetchData}
              className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : nearby.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Bus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No active buses right now</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {nearby.map(bus => (
                <div key={bus.bus} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        (bus.delay_minutes ?? 0) > 5 ? 'bg-red-100' : 'bg-green-100'}`}>
                        <Bus className={`w-5 h-5 ${(bus.delay_minutes ?? 0) > 5 ? 'text-red-600' : 'text-green-600'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{bus.busNumber ?? `Bus #${bus.bus.slice(-4)}`}</p>
                        {bus.routeName && <p className="text-xs text-gray-400 truncate">{bus.routeName}</p>}
                      </div>
                    </div>
                    <button onClick={() => toggleAlarm(bus.bus)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        alarms[bus.bus] ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      <Bell className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[120px]">{bus.nextStage?.stage_name ?? 'En route'}</span>
                    </span>
                    {bus.distanceKm != null && (
                      <span className="text-xs text-orange-600 font-medium">{bus.distanceKm} km away</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      (bus.delay_minutes ?? 0) > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {(bus.delay_minutes ?? 0) > 0 ? `+${bus.delay_minutes}m late` : '✓ On time'}
                    </span>
                    <span className="text-xs text-gray-400">{bus.speed ?? 0} km/h</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Demand Forecast */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span className="font-bold">AI Demand Forecast</span>
                </div>
                <p className="text-purple-200 text-sm mt-0.5">Next 6 hours · {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}</p>
              </div>
              <Link href="/passenger/map" className="text-xs text-purple-200 hover:text-white flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Open map
              </Link>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 6 }, (_, i) => {
                const h = (hour + i) % 24;
                const level = (h >= 7 && h <= 10) || (h >= 17 && h <= 20) ? 85 : h >= 22 || h <= 5 ? 15 : 55;
                return (
                  <div key={h} className="flex-1 text-center">
                    <div className="h-16 bg-white/20 rounded-lg relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 bg-white/50 rounded-lg" style={{ height: `${level}%` }} />
                    </div>
                    <p className="text-[10px] text-purple-200 mt-1">{h}:00</p>
                    <p className="text-[10px] text-white font-bold">{level}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-orange-500" /> Quick Actions
            </h3>
            <Link href="/passenger/search"
              className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-400 text-sm hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-colors mb-3">
              <Search className="w-4 h-4 shrink-0" />
              Search routes, stops…
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/passenger/map"    className="text-xs bg-orange-50 text-orange-700 rounded-xl py-2.5 text-center font-medium hover:bg-orange-100 transition-colors">🗺️ Live Map</Link>
              <Link href="/fare"             className="text-xs bg-green-50 text-green-700 rounded-xl py-2.5 text-center font-medium hover:bg-green-100 transition-colors">💰 Fare Calc</Link>
              <Link href="/passenger/alerts" className="text-xs bg-red-50 text-red-700 rounded-xl py-2.5 text-center font-medium hover:bg-red-100 transition-colors">🚨 Alerts</Link>
              <Link href="/how-to-board"     className="text-xs bg-blue-50 text-blue-700 rounded-xl py-2.5 text-center font-medium hover:bg-blue-100 transition-colors">ℹ️ How to Board</Link>
            </div>
          </div>

          {/* Saved Routes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" /> Saved Routes
              </h3>
              <Link href="/passenger/profile" className="text-xs text-orange-600 hover:text-orange-800">Manage</Link>
            </div>
            {favs.length === 0 ? (
              <div className="text-center py-6">
                <Heart className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No saved routes yet</p>
                <Link href="/passenger/search" className="text-xs text-orange-600 mt-1 inline-block">Search &amp; save →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {favs.slice(0, 4).map(fav => (
                  <Link key={fav._id} href="/passenger/search"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
                      <Star className="w-3.5 h-3.5 text-yellow-600" />
                    </div>
                    <span className="text-sm text-gray-800 flex-1 truncate">{fav.label ?? 'Saved route'}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* My Tickets */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-orange-500" /> My Tickets
              </h3>
              <RefreshCw className="w-3.5 h-3.5 text-gray-300 cursor-pointer hover:text-gray-500" onClick={fetchData} />
            </div>
            {tickets.length === 0 ? (
              <div className="text-center py-5">
                <QrCode className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No active tickets</p>
                <p className="text-xs text-gray-400 mt-1">Scan the QR on the bus gate to board</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.slice(0, 5).map(t => {
                  const expMins = getExpiry(t);
                  return (
                    <button key={t._id} onClick={() => setSelectedTicket(t)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-colors text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                        t.status === 'confirmed' ? 'bg-orange-100 text-orange-700' :
                        t.status === 'boarded'   ? 'bg-blue-100 text-blue-700' :
                        t.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        🎟️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-gray-900 truncate">{t.bookingRef}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {t.busNumber ? `Bus ${t.busNumber}` : 'Bus'} → {t.toStop || t.dropStop || '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full block ${
                          t.status === 'confirmed' ? 'bg-orange-100 text-orange-700' :
                          t.status === 'boarded'   ? 'bg-blue-100 text-blue-700' :
                          t.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.status}
                        </span>
                        {expMins !== null && t.status === 'confirmed' && (
                          <span className={`text-[10px] font-medium mt-0.5 block ${expMins < 15 ? 'text-red-500' : 'text-amber-500'}`}>
                            {expMins}m left
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alerts Panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-500" /> Service Alerts
              </h3>
              <Link href="/passenger/alerts" className="text-xs text-orange-600 hover:text-orange-800">View all</Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active alerts 🎉</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 3).map(alert => (
                  <div key={alert._id} className={`p-3 rounded-xl border text-xs font-medium ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                    alert.severity === 'warning'  ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'}`}>
                    <p className="truncate">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Travel Tip */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-bold text-orange-900">Travel Tip</span>
            </div>
            <p className="text-sm text-orange-700 leading-relaxed">
              {(hour >= 7 && hour <= 10)
                ? '🔴 Peak hours! Expect crowded buses — board early and scan the gate QR fast.'
                : (hour >= 17 && hour <= 20)
                ? '🔴 Evening rush! Use the Live Map to spot less crowded buses on your route.'
                : '🟢 Great time to travel — buses running smoothly!'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── TICKET QR MODAL ─── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedTicket(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white relative">
              <button onClick={() => setSelectedTicket(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Ticket className="w-5 h-5 text-orange-200" />
                <span className="text-sm text-orange-200 font-medium">Board Ticket</span>
              </div>
              <h2 className="text-xl font-extrabold">
                {selectedTicket.busNumber ? `Bus ${selectedTicket.busNumber}` : 'Scan-to-Board'}
              </h2>
              <p className="text-orange-200 text-sm mt-0.5">
                Drop: {selectedTicket.toStop || selectedTicket.dropStop || '—'}
              </p>
            </div>

            {/* Perforated divider */}
            <div className="relative h-5 bg-white">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-100 rounded-full" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-100 rounded-full" />
              <div className="border-t-2 border-dashed border-gray-200 absolute inset-x-4 top-1/2 -translate-y-1/2" />
            </div>

            {/* QR */}
            <div className="flex justify-center py-4">
              <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
                <QRCodeSVG
                  value={JSON.stringify({
                    bookingRef: selectedTicket.bookingRef,
                    bus:        selectedTicket.busNumber,
                    to:         selectedTicket.toStop || selectedTicket.dropStop,
                    seats:      selectedTicket.seatNumbers,
                    expires:    selectedTicket.expiresAt,
                  })}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Details */}
            <div className="px-5 pb-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Booking Ref</p>
                  <p className="font-bold text-gray-900 font-mono text-xs">{selectedTicket.bookingRef}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                  <p className={`font-bold capitalize text-sm ${
                    selectedTicket.status === 'confirmed' ? 'text-orange-600' :
                    selectedTicket.status === 'boarded'   ? 'text-blue-600' :
                    selectedTicket.status === 'cancelled' ? 'text-red-600' : 'text-gray-700'}`}>
                    {selectedTicket.status}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Drop Stop</p>
                  <p className="font-semibold text-gray-900 text-xs">{selectedTicket.toStop || selectedTicket.dropStop || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Fare</p>
                  <p className="font-bold text-orange-600 text-sm">₹{selectedTicket.fare}</p>
                </div>
              </div>
              {selectedTicket.seatNumbers?.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-xs text-orange-400 mb-1.5">Assigned Seats</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTicket.seatNumbers.map(s => (
                      <span key={s} className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg font-mono">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedTicket.expiresAt && (
                <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 text-xs">Valid for</span>
                  </div>
                  <span className={`font-bold text-sm ${(getExpiry(selectedTicket) ?? 99) < 15 ? 'text-red-600' : 'text-amber-600'}`}>
                    {getExpiry(selectedTicket)} min
                  </span>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Passengers
                </span>
                <span className="text-sm font-semibold text-gray-700">{selectedTicket.passengers}</span>
              </div>
            </div>

            <div className="p-4 pt-2">
              <p className="text-center text-xs text-gray-400 mb-3">Show QR to driver · Pay fare to conductor</p>
              <button onClick={() => setSelectedTicket(null)}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
