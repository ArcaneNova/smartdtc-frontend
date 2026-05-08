'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Bus } from '@/types';
import { Plus, Edit2, Trash2, X, RefreshCw, Activity, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

const statusColor: Record<string, string> = {
  active:       'green',
  idle:         'blue',
  maintenance:  'yellow',
  retired:      'red',
  'in-service': 'green',
};

const STATUS_OPTIONS = ['idle', 'active', 'in-service', 'maintenance', 'retired'];

const EMPTY_FORM = { busNumber: '', registrationNo: '', model: '', capacity: 40, type: 'non-AC', status: 'idle' };

export default function BusesPage() {
  const [buses,     setBuses]     = useState<Bus[]>([]);
  const [stats,     setStats]     = useState<{ _id: string; count: number }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editBus,   setEditBus]   = useState<Bus | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [statusBus, setStatusBus] = useState<Bus | null>(null);
  const [qrBus,     setQrBus]     = useState<Bus | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [busRes, statRes] = await Promise.all([
        api.get(`/buses?page=${page}&limit=20`),
        api.get('/buses/stats'),
      ]);
      setBuses(busRes.data.buses);
      setTotal(busRes.data.total);
      setStats(statRes.data.stats || []);
    } catch { toast.error('Failed to load buses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [page]);

  const openAdd = () => { setEditBus(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (b: Bus) => {
    setEditBus(b);
    setForm({ busNumber: b.busNumber, registrationNo: b.registrationNo || '', model: b.model || '', capacity: b.capacity, type: b.type, status: b.status });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditBus(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.busNumber.trim()) return toast.error('Bus number is required');
    setSaving(true);
    try {
      if (editBus) {
        await api.put(`/buses/${editBus._id}`, form);
        toast.success('Bus updated');
      } else {
        await api.post('/buses', form);
        toast.success('Bus added');
      }
      closeModal();
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteBus = async (id: string) => {
    if (!confirm('Delete this bus?')) return;
    try {
      await api.delete(`/buses/${id}`);
      toast.success('Bus deleted');
      fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  const quickStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/buses/${id}/status`, { status });
      toast.success(`Status set to ${status}`);
      setStatusBus(null);
      fetchAll();
    } catch { toast.error('Failed to update status'); }
  };

  const [generatingQr, setGeneratingQr] = useState(false);

  const generateQr = async (bus: Bus) => {
    setGeneratingQr(true);
    try {
      const { data } = await api.patch(`/buses/${bus._id}/generate-qr`);
      setQrBus(data.bus);
      setBuses(prev => prev.map(b => b._id === bus._id ? data.bus : b));
      toast.success('QR code generated!');
    } catch {
      toast.error('Failed to generate QR');
    } finally { setGeneratingQr(false); }
  };

  const totalBuses = stats.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Fleet Management ({total})</h1>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="p-2 text-gray-500 hover:text-blue-600"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" /> Add Bus
          </button>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => {
            const color = statusColor[s._id] || 'gray';
            return (
              <div key={s._id} className="bg-white rounded-xl p-4 shadow-sm border">
                <Activity className={`w-5 h-5 text-${color}-500 mb-1`} />
                <p className="text-2xl font-bold text-gray-800">{s.count}</p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{s._id} <span className="text-gray-400">/ {totalBuses} total</span></p>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Bus No.', 'Reg. No.', 'Model', 'Type', 'Capacity', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : buses.map((b) => {
              const color = statusColor[b.status] || 'gray';
              return (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{b.busNumber}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.registrationNo || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.model || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b.type === 'AC' ? 'bg-blue-100 text-blue-700' : b.type === 'electric' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {b.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.capacity}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setStatusBus(b)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-100 text-${color}-700 capitalize hover:opacity-80 transition`}>
                      {b.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(b)} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setQrBus(b)} className="text-sky-500 hover:text-sky-700" title="Bus QR Code"><QrCode className="w-4 h-4" /></button>
                    <button onClick={() => deleteBus(b._id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-4 border-t text-sm text-gray-600">
          <span>Showing {Math.min((page - 1) * 20 + 1, total)}-{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {qrBus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">Gate QR — {qrBus.busNumber}</h2>
              <button onClick={() => setQrBus(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {qrBus.busQrId ? (
              <>
                <div className="flex justify-center p-4 bg-gray-50 rounded-xl border">
                  <QRCodeSVG
                    value={`${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/scan/${qrBus.busQrId}`}
                    size={200}
                    level="H"
                    id={`qr-${qrBus._id}`}
                  />
                </div>
                <p className="text-xs text-gray-500 font-mono break-all">{qrBus.busQrId}</p>
                <p className="text-xs text-gray-400">Print and attach to bus gate. Passengers scan to pay &amp; board.</p>
                <button
                  onClick={() => {
                    const svg = document.getElementById(`qr-${qrBus._id}`)?.closest('svg');
                    if (!svg) return;
                    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${qrBus.busNumber}-gate-qr.svg`;
                    a.click();
                  }}
                  className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <QrCode size={16} /> Download QR SVG
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3 text-sm">
                  <QrCode className="w-4 h-4 shrink-0" />
                  <span>No QR code yet for this bus.</span>
                </div>
                <button
                  onClick={() => generateQr(qrBus)}
                  disabled={generatingQr}
                  className="w-full py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  {generatingQr
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><QrCode className="w-4 h-4" /> Generate QR Code</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {statusBus && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Change Status</h2>
              <button onClick={() => setStatusBus(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">Bus: <strong>{statusBus.busNumber}</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => {
                const color = statusColor[s] || 'gray';
                return (
                  <button key={s} onClick={() => quickStatus(statusBus._id, s)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 capitalize transition ${statusBus.status === s ? `border-${color}-500 bg-${color}-50 text-${color}-700` : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">{editBus ? 'Edit Bus' : 'Add New Bus'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bus Number *</label>
                  <input value={form.busNumber} onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                    placeholder="e.g. DTC-1042" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
                  <input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
                    placeholder="e.g. DL 1C 1234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. Tata Starbus" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input type="number" min={1} max={200} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="non-AC">Non-AC</option>
                    <option value="AC">AC</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editBus ? 'Update Bus' : 'Add Bus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
