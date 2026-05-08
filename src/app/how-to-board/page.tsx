'use client';

import Link from 'next/link';
import { QrCode, Smartphone, MapPin, CreditCard, ChevronRight } from 'lucide-react';

const steps = [
  { icon: QrCode,      color: 'bg-orange-500', num: '01', title: 'Find Your Bus & Scan', desc: 'Look for the QR code sticker at the bus gate. Open your camera app and scan it — no special app needed on web.' },
  { icon: MapPin,      color: 'bg-blue-500',   num: '02', title: 'Select Your Drop Stop', desc: 'The system fetches all upcoming stops for your bus. Tap the stop where you want to get off.' },
  { icon: Smartphone,  color: 'bg-purple-500', num: '03', title: 'Confirm Your Seat',     desc: 'Choose number of passengers, review the fare, and hit "Confirm". Your ticket is generated instantly with a 90-minute validity window.' },
  { icon: CreditCard,  color: 'bg-green-500',  num: '04', title: 'Pay the Conductor',    desc: 'Show your digital ticket QR to the conductor and pay the fare amount shown on the ticket on board. That\'s it!' },
];

export default function HowToBoardPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-8 text-white text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold">Scan &amp; Board</h1>
        <p className="text-orange-100 mt-2 text-sm">No pre-booking. No waiting. Just scan and go.</p>
      </div>

      <div className="space-y-4">
        {steps.map(({ icon: Icon, color, num, title, desc }) => (
          <div key={num} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex gap-5 items-start">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs text-gray-400 font-bold">Step {num}</span>
              <h2 className="text-base font-extrabold text-gray-900 mt-0.5">{title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
        <h3 className="font-bold text-amber-900 mb-2">📌 Good to Know</h3>
        <ul className="text-sm text-amber-800 space-y-1.5 list-disc list-inside">
          <li>Tickets are valid for 90 minutes from time of issue.</li>
          <li>Each bus has a permanent QR code — scan it each trip.</li>
          <li>You must be logged in to confirm a seat.</li>
          <li>Payment to conductor is cash-on-board (no online payment required).</li>
        </ul>
      </div>

      <Link href="/passenger"
        className="flex items-center justify-center gap-2 bg-orange-500 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 transition-colors">
        Back to Dashboard <ChevronRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
