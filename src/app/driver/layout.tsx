'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Map, Users, ClipboardList, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/driver',           icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/driver/trip',      icon: Map,             label: 'My Trip'   },
  { href: '/driver/passengers',icon: Users,           label: 'Passengers'},
  { href: '/driver/log',       icon: ClipboardList,   label: 'Trip Log'  },
  { href: '/driver/profile',   icon: User,            label: 'Profile'   },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto relative text-white">
      {/* Brand */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2 sticky top-0 z-40">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <span className="text-sm font-black text-white">D</span>
        </div>
        <span className="font-bold text-lg tracking-tight">SmartDTC</span>
        <span className="text-xs text-slate-400 ml-1">Driver</span>
        <span className="ml-auto text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Live
        </span>
      </header>

      <main className="flex-1 pb-20 overflow-hidden bg-slate-950">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900 border-t border-slate-800 z-50">
        <div className="flex">
          {tabs.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/driver' && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={cn('flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300')}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
