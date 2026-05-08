'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Alert } from '@/types';
import { connectSocket } from '@/lib/socket';
import { AlertTriangle, CheckCircle, Trash2, Plus, X, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const severityColor = { info: 'blue', warning: 'yellow', critical: 'red' } as const;
const ALERT_TYPES = ['delay', 'overcrowding', 'breakdown', 'route-change', 'traffic', 'sos'];
const EMPTY_FORM = { type: 'delay', severity: 'warning', message: '', routeId: '', busId: '' };

export default function AlertsPage() {
  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [resolved,   setResolved]   = useState<Alert[]>([]);
  const [tab,        setTab]        = useState<'active' | 'resolved'>('active');
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [creating,   setCreating]   = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const [activeRes, resolvedRes] = await Promise.all([
        api.get('/alerts?isResolved=false&limit=50'),
        api.get('/alerts?isResolved=true&limit=50'),
      ]);
      setAlerts(activeRes.data.alerts);
      setResolved(resolvedRes.data.alerts);
    } catch { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAlerts();
    const socket = connectSocket();
    socket.on('admin:new_alert', (a: Alert) => setAlerts((prev) => [a, ...prev]));
    socket.on('admin:alert_resolved', ({ alertId }: { alertId: string }) => {
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
    });
    return () => { socket.off('admin:new_alert'); socket.off('admin:alert_resolved'); };
  }, []);

  const resolve = async (id: string) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
      toast.success('Alert resolved');
      fetchAlerts();
    } catch { toast.error('Failed to resolve'); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
      setResolved((prev) => prev.filter((a) => a._id !== id));
      toast.success('Alert deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const createAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return toast.error('Message is required');
    setCreating(true);
    try {
      const payload: any = { type: form.type, severity: form.severity, message: form.message };
      if (form.routeId) payload.route = form.routeId;
      if (form.busId)   payload.bus   = form.busId;
      await api.post('/alerts', payload);
      toast.success('Alert created');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create alert');
    } finally { setCreating(false); }
  };

  const list = tab === 'active' ? alerts : resolved;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Alerts</h1>
        <div className="flex gap-2">
          <button onClick={fetchAlerts} className="p-2 text-gray-500 hover:text-blue-600"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition">
            <Plus className="w-4 h-4" /> Create Alert
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('active')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'active' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          Active ({alerts.length})
        </button>
        <button onClick={() => setTab('resolved')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'resolved' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          Resolved ({resolved.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>{tab === 'active' ? 'No active alerts' : 'No resolved alerts'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const color = severityColor[a.severity] ?? 'blue';
            return (
              <div key={a._id} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 flex items-start justify-between gap-4`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 text-${color}-500 mt-0.5 flex-shrink-0`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium uppercase tracking-wide text-${color}-700`}>{a.severity}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{a.type}</span>
                      {a.isResolved && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Resolved</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{a.message}</p>
                    {a.route && <p className="text-xs text-gray-500 mt-0.5">Route: {(a.route as any).route_name || a.route}</p>}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(a.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!a.isResolved && (
                    <button onClick={() => resolve(a._id)} title="Resolve" className="text-green-600 hover:text-green-800">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  <button onClick={() => del(a._id)} title="Delete" className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">Create Alert</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {ALERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3}
                  placeholder="Describe the alert..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route ID (optional)</label>
                  <input value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}
                    placeholder="MongoDB ObjectId" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bus ID (optional)</label>
                  <input value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })}
                    placeholder="MongoDB ObjectId" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
