'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Driver } from '@/types';
import { Plus, Edit2, Trash2, Star, Bus, X, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const statusColor: Record<string, string> = {
  'on-duty':  'green',
  'off-duty': 'gray',
  'on-leave': 'yellow',
};

const DRIVER_EMPTY = { name: '', email: '', phone: '', password: '', licenseNo: '', experience: 1 };
const EDIT_EMPTY   = { licenseNo: '', experience: 1, status: 'off-duty' };

interface BusOption { _id: string; busNumber: string; type: string; status: string; }

export default function DriversPage() {
  const [drivers,       setDrivers]       = useState<Driver[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [assignTarget,  setAssignTarget]  = useState<Driver | null>(null);
  const [busOptions,    setBusOptions]    = useState<BusOption[]>([]);
  const [selectedBus,   setSelectedBus]   = useState('');
  const [assigning,     setAssigning]     = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverForm,    setDriverForm]    = useState(DRIVER_EMPTY);
  const [savingDriver,  setSavingDriver]  = useState(false);
  const [editTarget,    setEditTarget]    = useState<Driver | null>(null);
  const [editForm,      setEditForm]      = useState(EDIT_EMPTY);
  const [savingEdit,    setSavingEdit]    = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/drivers?page=${page}&limit=20`);
      setDrivers(data.drivers);
      setTotal(data.total);
    } catch { toast.error('Failed to load drivers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDrivers(); }, [page]);

  const deleteDriver = async (id: string) => {
    if (!confirm('Delete this driver?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      toast.success('Driver removed');
      fetchDrivers();
    } catch { toast.error('Failed'); }
  };

  const openAssignModal = async (driver: Driver) => {
    setAssignTarget(driver);
    setSelectedBus((driver.assignedBus as any)?._id || '');
    try {
      const { data } = await api.get('/buses?status=active&limit=50');
      setBusOptions(data.buses || []);
    } catch { toast.error('Failed to load buses'); }
  };

  const submitAssign = async () => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await api.patch(`/drivers/${assignTarget._id}/assign`, { busId: selectedBus || null });
      toast.success('Bus assigned successfully!');
      setAssignTarget(null);
      fetchDrivers();
    } catch { toast.error('Failed to assign bus'); }
    finally { setAssigning(false); }
  };

  const openEdit = (d: Driver) => {
    setEditTarget(d);
    setEditForm({ licenseNo: d.licenseNo, experience: d.experience, status: d.status });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.put(`/drivers/${editTarget._id}`, editForm);
      toast.success('Driver updated');
      setEditTarget(null);
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update driver');
    } finally { setSavingEdit(false); }
  };

  const submitAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.name.trim() || !driverForm.email.trim() || !driverForm.password.trim() || !driverForm.licenseNo.trim())
      return toast.error('Name, email, password and license no. are required');
    setSavingDriver(true);
    try {
      await api.post('/auth/register', { ...driverForm, role: 'driver', experience: Number(driverForm.experience) });
      toast.success('Driver account created');
      setShowAddDriver(false);
      setDriverForm(DRIVER_EMPTY);
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create driver');
    } finally { setSavingDriver(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Drivers ({total})</h1>
        <div className="flex gap-2">
          <button onClick={fetchDrivers} className="p-2 text-gray-500 hover:text-blue-600"><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={() => { setDriverForm(DRIVER_EMPTY); setShowAddDriver(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Name', 'Email', 'License No.', 'Experience', 'Assigned Bus', 'Status', 'Rating', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : drivers.map((d) => {
              const color = statusColor[d.status] || 'gray';
              const user = d.userId as any;
              return (
                <tr key={d._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{user?.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{user?.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.licenseNo}</td>
                  <td className="px-4 py-3">{d.experience} yrs</td>
                  <td className="px-4 py-3">
                    {(d.assignedBus as any)?.busNumber
                      ? <span className="flex items-center gap-1 text-blue-600 font-medium"><Bus className="w-3 h-3" />{(d.assignedBus as any).busNumber}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-100 text-${color}-700`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    {d.rating?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openAssignModal(d)} className="text-green-500 hover:text-green-700" title="Assign Bus"><Bus className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(d)} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteDriver(d._id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-4 border-t text-sm text-gray-600">
          <span>Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* Edit Driver Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">Edit Driver</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Editing: <strong>{(editTarget.userId as any)?.name}</strong> ({(editTarget.userId as any)?.email})</p>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License No. *</label>
                <input value={editForm.licenseNo} onChange={(e) => setEditForm({ ...editForm, licenseNo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experience (yrs)</label>
                  <input type="number" min={0} max={50} value={editForm.experience} onChange={(e) => setEditForm({ ...editForm, experience: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="on-duty">On Duty</option>
                    <option value="off-duty">Off Duty</option>
                    <option value="on-leave">On Leave</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingEdit} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingEdit ? 'Saving…' : 'Update Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddDriver && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">Add New Driver</h2>
              <button onClick={() => setShowAddDriver(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitAddDriver} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                    placeholder="Driver full name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                    placeholder="driver@dtc.in" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    placeholder="+91 98765 43210" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input type="password" value={driverForm.password} onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                    placeholder="Min 8 characters" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required minLength={8} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License No. *</label>
                  <input value={driverForm.licenseNo} onChange={(e) => setDriverForm({ ...driverForm, licenseNo: e.target.value })}
                    placeholder="e.g. DL-0420110012345" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
                  <input type="number" min={0} max={50} value={driverForm.experience} onChange={(e) => setDriverForm({ ...driverForm, experience: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddDriver(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={savingDriver}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingDriver ? 'Creating…' : <><CheckCircle className="w-4 h-4" /> Create Driver</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Bus Modal */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Assign Bus</h2>
              <button onClick={() => setAssignTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600">Assigning bus to <strong>{(assignTarget.userId as any)?.name}</strong></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Bus</label>
              <select value={selectedBus} onChange={(e) => setSelectedBus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Unassign (no bus)</option>
                {busOptions.map((b) => (
                  <option key={b._id} value={b._id}>{b.busNumber} — {b.type} ({b.status})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAssignTarget(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={submitAssign} disabled={assigning}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {assigning ? 'Assigning…' : <><CheckCircle className="w-4 h-4" /> Assign</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
