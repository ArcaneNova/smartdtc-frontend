'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { AlertTriangle, Bell, CheckCircle, Info, Zap, RefreshCw, X } from 'lucide-react';

interface Alert {
  _id: string; type: string; severity: string; message: string;
  route?: { route_name: string }; bus?: { busNumber: string };
  isResolved: boolean; createdAt: string;
}

const sevConfig: Record<string, { icon: any; bg: string; border: string; text: string; badge: string }> = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    badge: 'bg-red-500 text-white' },
  warning:  { icon: Zap,           bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-500 text-white' },
  info:     { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-500 text-white' },
};

const typeIcon: Record<string, string> = {
  delay: '⏱️', overcrowding: '🚌', breakdown: '🔧', 'route-change': '🔄', traffic: '🚦', sos: '🆘',
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

export default function PassengerAlerts() {
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/alerts?limit=50');
      setAlerts(data.alerts || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const visible = alerts
    .filter(a => !dismissed.has(a._id))
    .filter(a => filter === 'all' || a.severity === filter)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
    });

  const critCount  = alerts.filter(a => a.severity === 'critical' && !a.isResolved).length;
  const warnCount  = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-bold text-gray-900">Service Alerts</h1>
            {critCount > 0 && (
              <p className="text-xs text-red-600 font-medium">{critCount} critical issue{critCount > 1 ? 's' : ''} active</p>
            )}
          </div>
          <button onClick={fetchAlerts} className="text-blue-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-red-600">{critCount}</p>
            <p className="text-[10px] text-red-400">Critical</p>
          </div>
          <div className="flex-1 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-yellow-600">{warnCount}</p>
            <p className="text-[10px] text-yellow-400">Warnings</p>
          </div>
          <div className="flex-1 bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-center">
            <p className="text-xl font-black text-green-600">{alerts.filter(a => a.isResolved).length}</p>
            <p className="text-[10px] text-green-400">Resolved</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'critical', 'warning', 'info'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filter === f ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-50" />
            <p className="font-medium text-gray-500">All Clear!</p>
            <p className="text-sm mt-1">No service alerts at this time</p>
          </div>
        ) : (
          visible.map(alert => {
            const cfg = sevConfig[alert.severity] ?? sevConfig.info;
            const Icon = cfg.icon;
            return (
              <div key={alert._id} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} relative`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {typeIcon[alert.type] ?? '📢'} {alert.type?.replace('-', ' ')}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${cfg.badge}`}>
                        {alert.severity}
                      </span>
                      {alert.isResolved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gray-200 text-gray-500">Resolved</span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${cfg.text}`}>{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      {alert.route && <span>📍 {alert.route.route_name}</span>}
                      {alert.bus   && <span>🚌 Bus {alert.bus.busNumber}</span>}
                      <span className="ml-auto">{timeAgo(alert.createdAt)}</span>
                    </div>
                  </div>
                  <button onClick={() => setDismissed(prev => new Set([...prev, alert._id]))} className="text-gray-300 hover:text-gray-400 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
