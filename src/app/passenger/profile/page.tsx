'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  User, Heart, Bus, Star, LogOut, Settings, Bell, Shield,
  ChevronRight, Clock, MapPin, Ticket, RefreshCw, Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Booking { _id: string; bookingRef: string; routeName?: string; departureTime?: string; status?: string; }
interface FavRoute { _id: string; label?: string; }

export default function PassengerProfile() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [favs,     setFavs]     = useState<FavRoute[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notif,    setNotif]    = useState(typeof window !== 'undefined' && Notification?.permission === 'granted');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [favRes, bookRes] = await Promise.allSettled([
          api.get('/mobile/passenger/favourites'),
          api.get('/mobile/passenger/bookings').catch(() => ({ data: { bookings: [] } })),
        ]);
        if (favRes.status === 'fulfilled')  setFavs(favRes.value.data.favourites || []);
        if (bookRes.status === 'fulfilled') setBookings(bookRes.value.data.bookings || []);
      } catch {}
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleNotif = async () => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        setNotif(perm === 'granted');
        if (perm === 'granted') toast.success('🔔 Notifications enabled!');
      } else {
        setNotif(false);
        toast('Notifications cannot be revoked via browser settings', { icon: 'ℹ️' });
      }
    }
  };

  const removeFav = async (id: string) => {
    await api.delete(`/mobile/passenger/favourites/${id}`).catch(() => {});
    setFavs(prev => prev.filter(f => f._id !== id));
    toast.success('Removed');
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <Shield className="w-16 h-16 text-blue-200 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to access your profile</h2>
      <p className="text-gray-400 text-sm mb-6">View bookings, saved routes and more</p>
      <button onClick={() => router.push('/login')} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold">Sign In</button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-6">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-800 px-5 pt-6 pb-10 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black">
            {user.name?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div>
            <h1 className="text-xl font-black">{user.name}</h1>
            <p className="text-blue-200 text-sm">{user.email}</p>
            {user.phone && <p className="text-blue-200 text-xs mt-0.5">{user.phone}</p>}
          </div>
          <button className="ml-auto"><Settings className="w-5 h-5 text-white/60" /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Saved Routes', value: favs.length,     icon: '⭐' },
            { label: 'Bookings',     value: bookings.length,  icon: '🎟️' },
            { label: 'Member Since', value: new Date(user.createdAt || Date.now()).getFullYear(), icon: '📅' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl">{icon}</p>
              <p className="text-lg font-black mt-1">{value}</p>
              <p className="text-[10px] text-blue-200 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">

        {/* Recent Bookings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm"><Ticket className="w-4 h-4 text-orange-500" /> Recent Bookings</h2>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : bookings.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bookings yet</p>
              <button onClick={() => router.push('/passenger/search')} className="mt-2 text-xs text-blue-600 font-medium">Search routes to book →</button>
            </div>
          ) : (
            <div className="divide-y">
              {bookings.slice(0, 3).map(b => (
                <div key={b._id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Bus className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.routeName ?? 'Route Booking'}</p>
                    <p className="text-xs text-gray-400">{b.bookingRef} {b.departureTime ? '· ' + new Date(b.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {b.status ?? 'Confirmed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Routes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm"><Heart className="w-4 h-4 text-red-500" /> Saved Routes</h2>
          </div>
          {favs.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No saved routes</p>
              <button onClick={() => router.push('/passenger/search')} className="mt-2 text-xs text-blue-600 font-medium">Search routes to save →</button>
            </div>
          ) : (
            <div className="divide-y">
              {favs.map(fav => (
                <div key={fav._id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Star className="w-4 h-4 text-yellow-600" />
                  </div>
                  <p className="flex-1 text-sm text-gray-800 font-medium truncate">{fav.label ?? 'Saved Route'}</p>
                  <button onClick={() => removeFav(fav._id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y">
            {/* Notifications toggle */}
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Bell className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
                <p className="text-xs text-gray-400">Bus alarms & service alerts</p>
              </div>
              <button
                onClick={toggleNotif}
                className={`w-12 h-6 rounded-full transition-colors relative ${notif ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${notif ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>

            <button onClick={() => router.push('/fare')} className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900">Fare Calculator</p>
                <p className="text-xs text-gray-400">Plan trip cost</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>

            <button onClick={() => router.push('/track')} className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <Bus className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900">Live Tracker</p>
                <p className="text-xs text-gray-400">Desktop tracking view</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-50 border border-red-100 text-red-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <p className="text-center text-xs text-gray-300 pb-2">SmartDTC Passenger App v2.0</p>
      </div>
    </div>
  );
}
