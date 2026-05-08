'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Bus, Map, Users, Calendar,
  AlertTriangle, BarChart3, LogOut, Navigation, History,
  UserCog, ChevronLeft, ChevronRight, Brain, Moon, Sun, X, Ticket, GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin',                 icon: LayoutDashboard, label: 'Dashboard'         },
  { href: '/admin/routes',          icon: Map,             label: 'Routes'            },
  { href: '/admin/buses',           icon: Bus,             label: 'Fleet'             },
  { href: '/admin/drivers',         icon: Users,           label: 'Drivers'           },
  { href: '/admin/schedule',        icon: Calendar,        label: 'Schedule'          },
  { href: '/admin/schedule/compare', icon: GitCompare,      label: 'Schedule Compare'  },
  { href: '/admin/bookings',        icon: Ticket,          label: 'Bookings'          },
  { href: '/admin/tracking',        icon: Navigation,      label: 'Live Map'          },
  { href: '/admin/demand',          icon: Brain,           label: 'Demand AI'         },
  { href: '/admin/reports/models',  icon: BarChart3,       label: 'Model Comparison'  },
  { href: '/admin/alerts',          icon: AlertTriangle,   label: 'Alerts'            },
  { href: '/admin/reports',         icon: BarChart3,       label: 'Reports'           },
  { href: '/admin/trips',           icon: History,         label: 'Trip History'      },
  { href: '/admin/users',           icon: UserCog,         label: 'Users'             },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname  = usePathname();
  const { user, logout } = useAuthStore();
  const { dark, toggle: toggleDark } = useThemeStore();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navContent = (
    <>
      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-white hover:bg-blue-600 transition-colors hidden lg:flex"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Logo */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-2 min-h-[64px]">
        <Bus className="w-7 h-7 text-blue-400 flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <span className="text-lg font-bold block leading-tight">SmartDTC</span>
            <p className="text-xs text-gray-400 capitalize">{user?.role} Panel</p>
          </div>
        )}
        {/* Mobile close */}
        {onMobileClose && (
          <button onClick={onMobileClose} className="ml-auto text-gray-400 hover:text-white lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={onMobileClose}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Dark mode + User + Logout */}
      <div className="p-3 border-t border-gray-700 space-y-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={cn(
            'flex items-center gap-2 text-gray-400 hover:text-yellow-400 text-sm w-full transition rounded-lg p-2',
            collapsed ? 'justify-center' : ''
          )}
        >
          {dark ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm w-full transition rounded-lg p-2',
            collapsed ? 'justify-center' : ''
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'bg-gray-900 text-white flex-col h-full transition-all duration-300 relative flex-shrink-0 hidden lg:flex',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative w-72 h-full bg-gray-900 text-white flex flex-col slide-in-left">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
