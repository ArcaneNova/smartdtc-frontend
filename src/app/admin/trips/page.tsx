'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, ChevronLeft, ChevronRight, AlertCircle, Search, Download } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Route { _id: string; route_name: string; }
interface Bus   { _id: string; busNumber: string; }
interface Driver{ _id: string; userId?: { name: string }; }

interface Trip {
  _id: string;
  route?: { route_name: string };
  bus?: { busNumber: string };
  driver?: { userId?: { name: string } };
  startTime: string;
  endTime?: string;
  status: string;
  delayMinutes?: number;
  averageSpeed?: number;
  passengerCount?: number;
}

const PAGE_LIMIT = 15;

const statusColor: Record<string, string> = {
  completed: 'green',
  'in-progress': 'blue',
  cancelled: 'red',
  scheduled: 'yellow',
};

function fmt(dt?: string) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function TripsPage() {
  const [trips, setTrips]         = useState<Trip[]>([]);
  const [routes, setRoutes]       = useState<Route[]>([]);
  const [buses, setBuses]         = useState<Bus[]>([]);
  const [drivers, setDrivers]     = useState<Driver[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Filters
  const [routeId, setRouteId]     = useState('');
  const [busId, setBusId]         = useState('');
  const [driverId, setDriverId]   = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [status, setStatus]       = useState('');

  // Pagination
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [r, b, d] = await Promise.all([
        api.get('/routes'),
        api.get('/buses'),
        api.get('/drivers'),
      ]);
      setRoutes(r.data?.routes ?? r.data?.data ?? []);
      setBuses(b.data?.buses ?? b.data?.data ?? []);
      setDrivers(d.data?.drivers ?? d.data?.data ?? []);
    } catch { /* silently ignore */ }
  }, []);

  const fetchTrips = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page: p, limit: PAGE_LIMIT };
      if (routeId)   params.routeId  = routeId;
      if (busId)     params.busId    = busId;
      if (driverId)  params.driverId = driverId;
      if (from)      params.from     = from;
      if (to)        params.to       = to;
      if (status)    params.status   = status;
      const res = await api.get('/reports/trips', { params });
      const body = res.data;
      setTrips(body.data ?? body.trips ?? body ?? []);
      setTotal(body.total ?? body.count ?? 0);
      setPage(p);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [routeId, busId, driverId, from, to, status]);

  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);
  useEffect(() => { fetchTrips(1); }, [fetchTrips]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const exportCSV = async () => {
    try {
      const params: Record<string, string | number> = { page: 1, limit: 5000 };
      if (routeId)  params.routeId  = routeId;
      if (busId)    params.busId    = busId;
      if (driverId) params.driverId = driverId;
      if (from)     params.from     = from;
      if (to)       params.to       = to;
      if (status)   params.status   = status;
      const res = await api.get('/reports/trips', { params });
      const rows: Trip[] = res.data.data ?? res.data.trips ?? [];
      const headers = ['Route', 'Bus', 'Driver', 'Start Time', 'End Time', 'Status', 'Delay (min)', 'Avg Speed', 'Passengers'];
      const csvRows = [
        headers.join(','),
        ...rows.map(t => [
          `"${t.route?.route_name ?? ''}"`,'"' + (t.bus?.busNumber ?? '') + '"','"' + (t.driver?.userId?.name ?? '') + '"',
          t.startTime ? new Date(t.startTime).toLocaleString() : '',
          t.endTime   ? new Date(t.endTime).toLocaleString()   : '',
          t.status ?? '', t.delayMinutes ?? '', t.averageSpeed ? Math.round(t.averageSpeed) : '', t.passengerCount ?? '',
        ].join(',')),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url; a.download = `dtc-trips-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} trips as CSV`);
    } catch { toast.error('CSV export failed'); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <History className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Trip History</h1>
            <p className="text-sm text-gray-500 mt-0.5">All completed and in-progress bus trips — {total} records</p>
          </div>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Route */}
          <select value={routeId} onChange={(e) => setRouteId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Routes</option>
            {routes.map((r) => <option key={r._id} value={r._id}>{r.route_name}</option>)}
          </select>

          {/* Bus */}
          <select value={busId} onChange={(e) => setBusId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Buses</option>
            {buses.map((b) => <option key={b._id} value={b._id}>{b.busNumber}</option>)}
          </select>

          {/* Driver */}
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Drivers</option>
            {drivers.map((d) => <option key={d._id} value={d._id}>{d.userId?.name ?? d._id}</option>)}
          </select>

          {/* Status */}
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Date From */}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          {/* Date To */}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex justify-end mt-3">
          <button onClick={() => { setRouteId(''); setBusId(''); setDriverId(''); setFrom(''); setTo(''); setStatus(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 mr-3">Clear filters</button>
          <button onClick={() => fetchTrips(1)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-500">
        {loading ? 'Loading…' : `${total} trip${total !== 1 ? 's' : ''} found`}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-gray-400">Loading trips…</p>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <History className="w-10 h-10 mx-auto mb-3" />
            <p>No trips found for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Route', 'Bus', 'Driver', 'Start Time', 'End Time', 'Status', 'Delay', 'Avg Speed', 'Passengers'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {trips.map((t) => {
                  const color = statusColor[t.status] ?? 'gray';
                  return (
                    <tr key={t._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-40 truncate">{t.route?.route_name ?? '—'}</td>
                      <td className="px-4 py-3">{t.bus?.busNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{t.driver?.userId?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(t.startTime)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(t.endTime)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-100 text-${color}-700 capitalize`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.delayMinutes != null
                          ? <span className={t.delayMinutes > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>{t.delayMinutes > 0 ? `+${t.delayMinutes}` : t.delayMinutes} min</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">{t.averageSpeed != null ? `${Math.round(t.averageSpeed)} km/h` : '—'}</td>
                      <td className="px-4 py-3">{t.passengerCount ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} — {total} total trips
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => fetchTrips(page - 1)}
              className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page >= totalPages} onClick={() => fetchTrips(page + 1)}
              className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
