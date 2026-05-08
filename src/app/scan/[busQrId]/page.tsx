'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bus, MapPin, CreditCard, CheckCircle, ArrowRight,
  Ticket, AlertCircle, Loader2, RefreshCw, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface StageWithFare {
  _id: string;
  seq: number;
  stage_name: string;
  fareFromHere: number;
  distanceKm: number;
}

interface BusInfo {
  _id: string;
  busNumber: string;
  busQrId: string;
  type: string;
  capacity: number;
}

interface ScanData {
  bus: BusInfo;
  route: { route_name: string; start_stage: string; end_stage: string } | null;
  schedule: { _id: string; departureTime: string; status: string; type: string } | null;
  currentStop: string | null;
  stages: StageWithFare[];
  razorpayKeyId: string;
}

interface BookingResult {
  bookingRef: string;
  seatNumbers: string[];
  toStop: string;
  fare: number;
  status: string;
  expiresAt: string;
  busNumber: string;
  busType: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ScanToBoardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const busQrId = params.busQrId as string;

  const [loading, setLoading] = useState(true);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [error, setError] = useState('');
  const [selectedDrop, setSelectedDrop] = useState<StageWithFare | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);

  // Load Razorpay script
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, []);

  const fetchBusInfo = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/public/bus-scan/${busQrId}`);
      setScanData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Bus QR not found or expired.');
    } finally { setLoading(false); }
  }, [busQrId]);

  useEffect(() => { fetchBusInfo(); }, [fetchBusInfo]);

  const totalFare = selectedDrop ? selectedDrop.fareFromHere * passengers : 0;

  const handlePay = async () => {
    if (!user) {
      toast.error('Please login to continue.');
      router.push(`/login?redirect=/scan/${busQrId}`);
      return;
    }
    if (!selectedDrop) { toast.error('Please select your drop stop.'); return; }
    if (!scanData) return;

    setPaying(true);
    try {
      // Create Razorpay order
      const orderRes = await api.post('/public/scan-book/create-order', {
        busQrId: scanData.bus.busQrId,
        scheduleId: scanData.schedule?._id,
        dropStageId: selectedDrop._id,
        dropStageName: selectedDrop.stage_name,
        fare: selectedDrop.fareFromHere,
        passengers,
      });

      const { id: orderId, amount, currency } = orderRes.data.order;

      // Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: scanData.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency,
        order_id: orderId,
        name: 'SmartDTC Bus',
        description: `Scan-to-Board: ${scanData.bus.busNumber} → ${selectedDrop.stage_name}`,
        prefill: { name: user.name || '', email: user.email || '' },
        theme: { color: '#0ea5e9' },
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post('/public/scan-book/verify-payment', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              busQrId:       scanData.bus.busQrId,
              scheduleId:    scanData.schedule?._id,
              dropStageName: selectedDrop.stage_name,
              fare:          selectedDrop.fareFromHere,
              passengers,
            });
            setBooking(verifyRes.data.booking);
            toast.success('Payment successful! Ticket issued.');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Payment verification failed.');
          } finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create order.');
      setPaying(false);
    }
  };

  /* ── TICKET VIEW ── */
  if (booking) {
    const qrPayload = JSON.stringify({
      bookingRef: booking.bookingRef,
      seats:      booking.seatNumbers,
      bus:        booking.busNumber,
      to:         booking.toStop,
      expires:    booking.expiresAt,
    });
    const expiresIn = Math.max(0, Math.round((new Date(booking.expiresAt).getTime() - Date.now()) / 60000));

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
            <CheckCircle className="mx-auto mb-2" size={48} />
            <h1 className="text-2xl font-bold">Ticket Issued!</h1>
            <p className="text-green-100 text-sm mt-1">Scan-to-Board Ticket</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center py-6 border-b border-dashed border-gray-200">
            <QRCodeSVG value={qrPayload} size={180} level="H" />
          </div>

          {/* Details */}
          <div className="p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Booking Ref</span>
              <span className="font-mono font-bold text-gray-800">{booking.bookingRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bus</span>
              <span className="font-semibold">{booking.busNumber} ({booking.busType})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Drop Stop</span>
              <span className="font-semibold">{booking.toStop}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fare Paid</span>
              <span className="font-bold text-green-600">₹{booking.fare}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Seats</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {booking.seatNumbers.map(s => (
                  <span key={s} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-mono">{s}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-gray-500 flex items-center gap-1"><Clock size={14} /> Valid for</span>
              <span className={`font-bold ${expiresIn < 15 ? 'text-red-600' : 'text-amber-600'}`}>{expiresIn} min</span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 text-center text-xs text-gray-400">
            Show this QR to the driver on boarding
          </div>
        </div>
      </div>
    );
  }

  /* ── LOADING / ERROR ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={48} />
      </div>
    );
  }
  if (error || !scanData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
          <p className="text-gray-700 font-medium">{error || 'Something went wrong.'}</p>
          <button onClick={fetchBusInfo} className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-sky-500 text-white rounded-lg text-sm">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── MAIN UI ── */
  const { bus, route, schedule, currentStop, stages } = scanData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Banner */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white px-5 py-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Bus size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{bus.busNumber}</h1>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{bus.type}</span>
          </div>
        </div>
        {route && (
          <p className="text-sky-100 text-sm flex items-center gap-1">
            <MapPin size={14} /> {route.route_name}
          </p>
        )}
        {currentStop && (
          <p className="text-xs text-sky-200 mt-1">Currently near: <span className="font-semibold text-white">{currentStop}</span></p>
        )}
        {schedule && (
          <div className="flex items-center gap-2 mt-2 text-xs text-sky-200">
            <span className={`px-2 py-0.5 rounded-full font-medium ${schedule.status === 'in-progress' ? 'bg-green-500 text-white' : 'bg-white/20'}`}>
              {schedule.status === 'in-progress' ? '🟢 Running' : schedule.status}
            </span>
            <span>Dep: {new Date(schedule.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Drop stop selector */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-sky-500" /> Select Your Drop Stop
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No stops available for this route.</p>
            )}
            {stages.map(s => (
              <button
                key={s._id}
                onClick={() => setSelectedDrop(s)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all
                  ${selectedDrop?._id === s._id
                    ? 'border-sky-500 bg-sky-50 text-sky-700 font-semibold'
                    : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50 text-gray-700'}`}
              >
                <span>{s.stage_name}</span>
                <span className={`font-bold ${selectedDrop?._id === s._id ? 'text-sky-600' : 'text-gray-500'}`}>
                  ₹{s.fareFromHere}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Passengers */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Passengers</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPassengers(p => Math.max(1, p - 1))}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold flex items-center justify-center"
            >−</button>
            <span className="text-xl font-bold w-8 text-center">{passengers}</span>
            <button
              onClick={() => setPassengers(p => Math.min(6, p + 1))}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold flex items-center justify-center"
            >+</button>
            <span className="text-sm text-gray-400 ml-2">max 6</span>
          </div>
        </div>

        {/* Fare summary */}
        {selectedDrop && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Drop Stop</span>
              <span className="font-semibold">{selectedDrop.stage_name}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Fare × {passengers}</span>
              <span>₹{selectedDrop.fareFromHere} × {passengers}</span>
            </div>
            <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t border-sky-200">
              <span>Total</span>
              <span className="text-sky-700">₹{totalFare}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">~{selectedDrop.distanceKm} km · {bus.type} fare</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={!selectedDrop || paying}
          className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-base transition-all"
        >
          {paying ? (
            <><Loader2 size={20} className="animate-spin" /> Processing…</>
          ) : (
            <><CreditCard size={20} /> Pay ₹{totalFare || '—'} & Board</>
          )}
        </button>

        {!user && (
          <p className="text-center text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200">
            ⚠️ You'll be asked to login before payment.
          </p>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Secured by Razorpay · Ticket valid for 90 minutes
        </p>
      </div>
    </div>
  );
}
