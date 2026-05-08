'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  Search, Filter, Eye, X, CheckCircle, Clock, XCircle,
  RefreshCw, Download, Users, Ticket, TrendingUp, Bus,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Booking {
  _id: string;
  bookingRef: string;
  user: { _id: string; name: string; email: string; phone?: string };
  route?: { _id: string; route_name: string; start_stage: string; end_stage: string };
  schedule?: { _id: string; departureTime: string; arrivalTime: string; date: string };
  passengers: number;
  boardingStop: string;
  dropStop: string;
  seatPreference: string;
  status: 'confirmed' | 'boarded' | 'cancelled' | 'completed';
  fare: number;
  createdAt: string;
}

interface BookingStats {
  total: number;
  confirmed: number;
  boarded: number;
  cancelled: number;
  completed: number;
  totalPassengers: number;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  boarded:   'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
};

const PAGE_SIZE = 15;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(search ? { search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await api.get(`/admin/bookings?${params}`);
      setBookings(res.data.bookings || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) setStats(res.data.stats);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.patch(`/mobile/bookings/${id}`, { status });
      setBookings(prev => prev.map(b => b._id === id ? { ...b, status: status as any } : b));
      if (selected?._id === id) setSelected(prev => prev ? { ...prev, status: status as any } : null);
      toast.success(`Booking status updated to ${status}`);
    } catch {
      toast.error('Failed to update booking');
    } finally {
      setUpdating(null);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Ref', 'Passenger', 'Email', 'Route', 'Boarding', 'Drop', 'Pax', 'Seat', 'Status', 'Date'],
      ...bookings.map(b => [
        b.bookingRef,
        b.user?.name || '',
        b.user?.email || '',
        b.route?.route_name || '',
        b.boardingStop,
        b.dropStop,
        b.passengers,
        b.seatPreference,
        b.status,
        new Date(b.createdAt).toLocaleDateString('en-IN'),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Ticket className="w-6 h-6 text-orange-500" /> Booking Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all passenger bookings across routes and schedules</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats?.total ?? 0, icon: Ticket, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Confirmed', value: stats?.confirmed ?? 0, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Boarded', value: stats?.boarded ?? 0, icon: Bus, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Completed', value: stats?.completed ?? 0, icon: TrendingUp, color: 'text-gray-500', bg: 'bg-gray-50' },
          { label: 'Cancelled', value: stats?.cancelled ?? 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Total Pax', value: stats?.totalPassengers ?? 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border">
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ref, passenger name, email..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['all', 'confirmed', 'boarded', 'completed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                statusFilter === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={fetchBookings} className="p-2 text-gray-500 hover:text-orange-500 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Loading bookings…</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Ref', 'Passenger', 'Route', 'Trip', 'Pax', 'Seat', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => (
                  <tr key={b._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-800 whitespace-nowrap">{b.bookingRef}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.user?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{b.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="font-medium text-gray-700 truncate">{b.route?.route_name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{b.boardingStop} → {b.dropStop}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                      {b.schedule?.departureTime ? `${b.schedule.departureTime} → ${b.schedule.arrivalTime}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{b.passengers}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{b.seatPreference}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelected(b)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => updateStatus(b._id, 'cancelled')}
                            disabled={updating === b._id}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Cancel booking"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {b.status === 'confirmed' && (
                          <button
                            onClick={() => updateStatus(b._id, 'boarded')}
                            disabled={updating === b._id}
                            className="p-1.5 text-green-500 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Mark boarded"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Booking Details</h2>
                <p className="text-sm text-gray-400 font-mono">{selected.bookingRef}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Passenger', value: `${selected.user?.name} (${selected.user?.email})` },
                { label: 'Route', value: selected.route?.route_name || '—' },
                { label: 'Boarding Stop', value: selected.boardingStop || '—' },
                { label: 'Drop-off Stop', value: selected.dropStop || '—' },
                { label: 'Departure', value: selected.schedule?.departureTime || '—' },
                { label: 'Passengers', value: String(selected.passengers) },
                { label: 'Seat Preference', value: selected.seatPreference },
                { label: 'Status', value: selected.status },
                { label: 'Booked On', value: new Date(selected.createdAt).toLocaleString('en-IN') },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm border-b pb-2 last:border-0">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-semibold text-gray-800 text-right max-w-[55%]">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="p-5 border-t flex gap-3">
              {selected.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => updateStatus(selected._id, 'boarded')}
                    disabled={!!updating}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
                  >
                    Mark Boarded
                  </button>
                  <button
                    onClick={() => updateStatus(selected._id, 'cancelled')}
                    disabled={!!updating}
                    className="flex-1 bg-red-100 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 disabled:opacity-50"
                  >
                    Cancel Booking
                  </button>
                </>
              )}
              {selected.status === 'boarded' && (
                <button
                  onClick={() => updateStatus(selected._id, 'completed')}
                  disabled={!!updating}
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                >
                  Mark Completed
                </button>
              )}
              <button onClick={() => setSelected(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
