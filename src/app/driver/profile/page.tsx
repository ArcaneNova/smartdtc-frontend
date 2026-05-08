'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  User, Bus, Star, Shield, Clock, LogOut, Settings,
  ChevronRight, AlertCircle, CheckCircle, RefreshCw, Phone, Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DriverProfile {
  _id: string; licenseNo: string; experience: number; status: string; rating: number;
  assignedBus?: { busNumber: string; model: string; type: string; capacity: number };
  assignedRoute?: { route_name: string };
}

const statusOpts = ['on-duty', 'off-duty', 'on-leave'];

export default function DriverProfile() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [profile,  setProfile]  = useState<DriverProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    api.get('/mobile/driver/profile')
      .then(r => setProfile(r.data.driver))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await api.patch('/mobile/driver/status', { status });
      setProfile(p => p ? { ...p, status } : p);
      toast.success(`Status updated: ${status}`);
    } catch { toast.error('Failed to update status'); }
    setUpdating(false);
  };

  const handleLogout = async () => { await logout(); router.push('/login'); };

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <Shield className="w-16 h-16 text-slate-600 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Not signed in</h2>
      <button onClick={() => router.push('/login')} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-bold mt-4">Sign In</button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-slate-950 overflow-y-auto pb-6">
      {/* Profile hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 pt-6 pb-8 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl font-black text-white">
            {user.name?.[0]?.toUpperCase() ?? 'D'}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">{user.name}</h1>
            <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3 h-3" /> {user.email}
            </p>
            {user.phone && <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3" /> {user.phone}
            </p>}
          </div>
        </div>

        {/* Driver info */}
        {loading ? (
          <div className="mt-4 h-16 bg-slate-700 rounded-xl animate-pulse" />
        ) : profile && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-slate-700/50 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-yellow-400">{profile.rating?.toFixed(1) ?? '—'}</p>
              <p className="text-[10px] text-slate-400">Rating ⭐</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3 text-center">
              <p className="text-lg font-black text-blue-400">{profile.experience ?? 0}</p>
              <p className="text-[10px] text-slate-400">Years exp</p>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3 text-center">
              <p className={`text-sm font-black capitalize ${profile.status === 'on-duty' ? 'text-green-400' : 'text-slate-400'}`}>{profile.status}</p>
              <p className="text-[10px] text-slate-400">Status</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Status Switcher */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">My Status</p>
          <div className="flex gap-2">
            {statusOpts.map(s => (
              <button key={s} disabled={updating} onClick={() => updateStatus(s)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  profile?.status === s
                    ? s === 'on-duty' ? 'bg-green-600 text-white'
                    : s === 'on-leave' ? 'bg-yellow-600 text-white'
                    : 'bg-slate-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}>
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Assigned Bus */}
        {profile?.assignedBus && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Bus className="w-4 h-4 text-orange-400" /> Assigned Bus
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Bus No.',  value: profile.assignedBus.busNumber },
                { label: 'Model',    value: profile.assignedBus.model },
                { label: 'Type',     value: profile.assignedBus.type },
                { label: 'Capacity', value: `${profile.assignedBus.capacity} seats` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-700/50 rounded-xl p-2.5">
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="font-semibold text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned Route */}
        {profile?.assignedRoute && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Assigned Route</p>
              <p className="font-bold text-white text-sm">{profile.assignedRoute.route_name}</p>
            </div>
          </div>
        )}

        {/* Driver ID */}
        {profile?.licenseNo && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <p className="text-[10px] text-slate-400 mb-0.5">License Number</p>
            <p className="font-black text-white text-lg font-mono tracking-wider">{profile.licenseNo}</p>
          </div>
        )}

        {/* Sign Out */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-red-900/30 border border-red-800/50 text-red-400 py-4 rounded-2xl font-bold">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        <p className="text-center text-xs text-slate-600 pb-2">SmartDTC Driver App v2.0</p>
      </div>
    </div>
  );
}
