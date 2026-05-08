'use client';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

const inter = Inter({ subsets: ['latin'] });

function ThemeManager({ children }: { children: React.ReactNode }) {
  const dark = useThemeStore(s => s.dark);

  useEffect(() => {
    const html = document.documentElement;
    if (dark) html.classList.add('dark');
    else html.classList.remove('dark');
  }, [dark]);

  return <>{children}</>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeManager>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontSize: '0.875rem' },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </ThemeManager>
      </body>
    </html>
  );
}
