'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Bus, Eye, EyeOff, Users, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [role,     setRole]     = useState<'passenger' | 'driver' | 'admin'>('passenger');
  const { login, isLoading }   = useAuthStore();
  const router                 = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      // Route based on role
      const stored = useAuthStore.getState().user;
      const r = stored?.role ?? role;
      if (r === 'driver') router.push('/driver');
      else if (r === 'passenger') router.push('/passenger');
      else router.push('/admin');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed');
    }
  };

  const portals = [
    { id: 'passenger' as const, label: 'Passenger', icon: Users,  desc: 'Track buses, book seats',    color: 'from-blue-600 to-indigo-600' },
    { id: 'driver'    as const, label: 'Driver',    icon: Bus,    desc: 'View schedule, manage trips', color: 'from-orange-500 to-red-500' },
    { id: 'admin'     as const, label: 'Admin',     icon: Shield, desc: 'Full system access',          color: 'from-purple-600 to-pink-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
            <Bus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">SmartDTC</h1>
          <p className="text-blue-300 text-sm mt-1">AI-Powered Transit System</p>
        </div>

        {/* Portal selector */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {portals.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => setRole(id)}
              className={`rounded-2xl p-3 text-center transition-all border ${
                role === id ? `bg-gradient-to-br ${color} border-transparent shadow-lg` : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${role === id ? 'text-white' : 'text-white/50'}`} />
              <p className={`text-xs font-bold ${role === id ? 'text-white' : 'text-white/50'}`}>{label}</p>
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white/8 backdrop-blur border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-5">
            Sign in as {portals.find(p => p.id === role)?.label}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder={role === 'admin' ? 'admin@dtc.in' : role === 'driver' ? 'driver@dtc.in' : 'passenger@dtc.in'}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 text-sm transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 text-sm transition"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading}
              className={`w-full py-3.5 rounded-xl font-black text-white text-sm transition disabled:opacity-50 bg-gradient-to-r ${portals.find(p => p.id === role)?.color}`}
            >
              {isLoading ? 'Signing in…' : `Enter as ${portals.find(p => p.id === role)?.label}`}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/register" className="text-xs text-white/40 hover:text-white/70 transition">Don't have an account? Register →</Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">SmartDTC · Delhi Transport Corporation</p>
      </div>
    </div>
  );
}
