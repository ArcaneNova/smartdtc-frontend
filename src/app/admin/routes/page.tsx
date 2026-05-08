'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { Route } from '@/types';
import { Search, Plus, Edit2, Trash2, X, Eye, ToggleLeft, ToggleRight, RefreshCw, Map } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = { route_name: '', start_stage: '', end_stage: '', distance_km: '', isActive: true };

export default function RoutesPage() {
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.append('search', search);
      if (activeFilter !== 'all') params.append('isActive', activeFilter === 'active' ? 'true' : 'false');
      const { data } = await api.get(`/routes?${params}`);
      setRoutes(data.routes);
      setTotal(data.total);
    } catch { toast.error('Failed to load routes'); }
    finally { setLoading(false); }
  }, [search, page, activeFilter]);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const openAdd = () => { setEditRoute(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (r: Route) => {
    setEditRoute(r);
    setForm({ route_name: r.route_name, start_stage: r.start_stage, end_stage: r.end_stage, distance_km: String(r.distance_km ?? ''), isActive: r.isActive ?? true });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.route_name.trim()) return toast.error('Route name is required');
    setSaving(true);
    try {
      const payload = { ...form, distance_km: form.distance_km ? Number(form.distance_km) : undefined };
      if (editRoute) {
        await api.put(`/routes/${editRoute._id}`, payload);
        toast.success('Route updated');
      } else {
        await api.post('/routes', payload);
        toast.success('Route added');
      }
      setShowModal(false); setEditRoute(null);
      fetchRoutes();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm('Delete this route?')) return;
    try {
      await api.delete(`/routes/${id}`);
      toast.success('Route deleted');
      fetchRoutes();
    } catch { toast.error('Failed to delete route'); }
  };

  const toggleActive = async (r: Route) => {
    setToggling(r._id);
    try {
      await api.patch(`/routes/${r._id}/toggle`);
      toast.success(`Route ${!r.isActive ? 'activated' : 'deactivated'}`);
      fetchRoutes();
    } catch { toast.error('Failed to toggle route status'); }
    finally { setToggling(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Map className="w-6 h-6 text-blue-500" /> Routes ({total})
        </h1>
        <div className="flex gap-2">
          <button onClick={fetchRoutes} className="p-2 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Route
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search routes…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => { setActiveFilter(f); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${activeFilter === f ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Route ID', 'Name', 'From', 'To', 'Distance', 'Stops', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : routes.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No routes found</td></tr>
            ) : routes.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.url_route_id}</td>
                <td className="px-4 py-3 font-medium text-gray-800 max-w-48 truncate">{r.route_name}</td>
                <td className="px-4 py-3 text-gray-600 max-w-32 truncate">{r.start_stage}</td>
                <td className="px-4 py-3 text-gray-600 max-w-32 truncate">{r.end_stage}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.distance_km?.toFixed(1) ?? '—'} km</td>
                <td className="px-4 py-3">{r.total_stages ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(r)}
                    disabled={toggling === r._id}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${r.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} disabled:opacity-50`}
                    title="Click to toggle active status"
                  >
                    {toggling === r._id
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : r.isActive ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                    {r.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/admin/routes/${r._id}`} className="text-purple-500 hover:text-purple-700" title="View Details">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteRoute(r._id)} className="text-red-500 hover:text-red-700" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t text-sm text-gray-600">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* Add / Edit Route Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">{editRoute ? 'Edit Route' : 'Add New Route'}</h2>
              <button onClick={() => { setShowModal(false); setEditRoute(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
                <input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })}
                  placeholder="e.g. ISBT Kashmere Gate to Dwarka Sector 21"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Stage *</label>
                  <input value={form.start_stage} onChange={(e) => setForm({ ...form, start_stage: e.target.value })}
                    placeholder="Starting stop"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Stage *</label>
                  <input value={form.end_stage} onChange={(e) => setForm({ ...form, end_stage: e.target.value })}
                    placeholder="Ending stop"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                  <input type="number" min={0} step={0.1} value={form.distance_km}
                    onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                    placeholder="e.g. 24.5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" id="isActive" checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active route</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditRoute(null); }} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : editRoute ? 'Update Route' : 'Add Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
