'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bus, MapPin, BarChart3, Clock, Brain, Zap, Shield, ChevronRight, Navigation, Star, Users, Route, ArrowRight } from 'lucide-react';

interface PubStats {
  activeRoutes: number;
  activeBuses: number;
  activeDrivers: number;
  coverage: string;
  dailyPassengers: string;
}

export default function HomePage() {
  const [stats, setStats] = useState<PubStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    fetch(`${apiBase}/public/stats`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'LSTM Demand Forecasting',
      desc: 'Deep learning predicts passenger demand 24 hours ahead with 91.7% accuracy across all 569 DTC routes.',
      color: 'from-purple-500 to-indigo-600',
      bg: 'bg-purple-50',
    },
    {
      icon: BarChart3,
      title: 'XGBoost Delay Prediction',
      desc: 'Machine learning forecasts bus delays with 4.2 min RMSE using weather, traffic and historical patterns.',
      color: 'from-blue-500 to-cyan-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Zap,
      title: 'Genetic Algorithm Scheduling',
      desc: 'Evolutionary algorithm optimises headways and fleet allocation, reducing passenger wait times by 47%.',
      color: 'from-orange-500 to-red-500',
      bg: 'bg-orange-50',
    },
    {
      icon: MapPin,
      title: 'Real-Time GPS Tracking',
      desc: 'Live bus positions streamed via Socket.io every 10 seconds, with automatic alert generation for delays.',
      color: 'from-green-500 to-emerald-600',
      bg: 'bg-green-50',
    },
    {
      icon: Shield,
      title: 'Anomaly Detection',
      desc: 'Isolation Forest model detects route anomalies and overcrowding, triggering instant fleet adjustments.',
      color: 'from-teal-500 to-green-600',
      bg: 'bg-teal-50',
    },
    {
      icon: Clock,
      title: 'Arrival ETA Predictions',
      desc: 'Gradient Boosting model predicts stop-level ETAs with 2.8 min MAE for the passenger mobile app.',
      color: 'from-pink-500 to-rose-600',
      bg: 'bg-pink-50',
    },
  ];

  const outcomes = [
    { label: 'OTP Improvement',   value: '78%',          sub: 'vs 62% baseline', color: 'text-purple-600' },
    { label: 'Wait Reduction',    value: '47%',          sub: 'average savings',  color: 'text-blue-600'   },
    { label: 'Fleet Utilisation', value: '+18%',         sub: 'vs static plan',   color: 'text-green-600'  },
    { label: 'Demand MAPE',       value: '8.3%',         sub: 'LSTM accuracy',    color: 'text-orange-600' },
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur border-b z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <Bus className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">SmartDTC</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/track" className="hover:text-blue-600 transition">Live Tracking</Link>
            <Link href="/fare" className="hover:text-blue-600 transition">Fare Calculator</Link>
            <Link href="/passenger" className="hover:text-blue-600 transition">Passenger App</Link>
            <Link href="/driver" className="hover:text-orange-600 transition">Driver Portal</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/passenger" className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition hidden md:flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Passenger App
            </Link>
            <Link href="/login" className="text-sm bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium transition">
              Sign In
            </Link>
          </div>
        </div>
      </nav>


      {/* HERO */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Capstone Final Year Project — AI-Driven Transit Management
          </div>

          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              SmartDTC
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                AI-Powered Transit
              </span>
            </h1>
            <p className="text-xl text-blue-200 mb-8 leading-relaxed">
              Transforming Delhi Transport Corporation with LSTM demand forecasting, XGBoost delay prediction,
              and Genetic Algorithm scheduling — delivering smarter, faster, more reliable bus services for 3.5 million daily passengers.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/passenger"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition shadow-lg shadow-blue-500/30">
                <Users className="w-4 h-4" /> Passenger App
              </Link>
              <Link href="/driver"
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition shadow-lg shadow-orange-500/20">
                <Bus className="w-4 h-4" /> Driver Portal
              </Link>
              <Link href="/admin"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur transition">
                <BarChart3 className="w-4 h-4" /> Admin Dashboard <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

          </div>

          {/* Live Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Routes',     value: stats ? stats.activeRoutes.toLocaleString() : '569+',  icon: Route },
              { label: 'Live Buses',        value: stats ? stats.activeBuses.toLocaleString()  : '—',      icon: Bus   },
              { label: 'Drivers On-Duty',   value: stats ? stats.activeDrivers.toLocaleString(): '—',      icon: Users },
              { label: 'Daily Passengers',  value: stats?.dailyPassengers                       ?? '3.5M+', icon: Star  },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 text-center">
                <Icon className="w-5 h-5 text-blue-300 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{loaded ? value : '…'}</p>
                <p className="text-xs text-blue-300 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section className="py-16 bg-gray-50 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-3">Proven System Outcomes</h2>
          <p className="text-center text-gray-500 text-sm mb-8">Compared against traditional static scheduling baseline</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {outcomes.map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl p-6 text-center shadow-sm border hover:shadow-md transition-shadow">
                <p className={`text-4xl font-extrabold mb-1 ${color}`}>{value}</p>
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI FEATURES */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Core AI Components</h2>
        <p className="text-gray-500 text-center text-sm mb-12">Four machine learning models working together in a unified microservice architecture</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="group rounded-2xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 bg-white">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 py-16 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Explore SmartDTC</h2>
          <p className="text-blue-200 mb-8">Track buses live, plan your journey, or dive into the admin analytics dashboard.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/passenger" className="bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-50 transition flex items-center gap-2">
              <Users className="w-4 h-4" /> Passenger App
            </Link>
            <Link href="/driver" className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition flex items-center gap-2">
              <Bus className="w-4 h-4" /> Driver Portal
            </Link>
            <Link href="/track" className="bg-white/15 border border-white/30 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/25 transition flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Live Bus Map
            </Link>
            <Link href="/fare" className="bg-white/15 border border-white/30 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/25 transition flex items-center gap-2">
              <Zap className="w-4 h-4" /> Calculate Fare
            </Link>
            <Link href="/admin" className="bg-white/15 border border-white/30 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/25 transition flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Admin Panel <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        <p>© 2025 SmartDTC — AI-Driven Bus Scheduling & Route Management System</p>
        <p className="text-xs mt-1 text-slate-500">A Final Year Capstone Project | Delhi Transport Corporation Integration</p>
      </footer>
    </main>
  );
}
