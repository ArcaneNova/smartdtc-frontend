'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MapIcon, Search, Bell, User, Bus, Ticket, LogOut, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { href: '/passenger',         icon: Home,    label: 'Dashboard'  },
  { href: '/passenger/map',     icon: MapIcon, label: 'Live Map'   },
  { href: '/passenger/search',  icon: Search,  label: 'Search'     },
  { href: '/passenger/booking', icon: Ticket,  label: 'Book Seat'  },
  { href: '/passenger/alerts',  icon: Bell,    label: 'Alerts'     },
  { href: '/passenger/profile', icon: User,    label: 'Profile'    },
];

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─── TOP HEADER ───────────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-lg h-14">
        <Link href="/" className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Bus className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-xl tracking-tight hidden sm:inline">SmartDTC</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/passenger' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Live indicator + user */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs bg-green-400/20 text-green-200 border border-green-400/30 px-2 py-1 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {user.name?.[0]?.toUpperCase() ?? 'P'}
              </div>
              <span className="text-sm font-medium hidden lg:inline">{user.name}</span>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── BODY ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar (desktop only) */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 sticky top-14 h-[calc(100vh-3.5rem)] shrink-0">
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/passenger' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className={cn('w-4 h-4', active ? 'text-blue-600' : 'text-gray-400')} />
                  {label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
              <Zap className="w-4 h-4 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 truncate">{user?.name ?? 'Passenger'}</p>
                <p className="text-[10px] text-blue-500 truncate">{user?.email ?? ''}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* ─── BOTTOM NAV (mobile only) ─────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex max-w-lg mx-auto">
          {navItems.slice(0, 5).map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/passenger' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className={cn('w-5 h-5', active ? 'text-blue-600' : '')} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
