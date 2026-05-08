'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Route } from '@/types';

function SearchContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [results, setResults] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const performSearch = async () => {
    if (!query.trim() && !from.trim() && !to.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      params.append('limit', '30');

      const res = await api.get(`/routes?${params.toString()}`);
      setResults(res.data.routes || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query || from || to) performSearch();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-dtc-blue text-white px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Find Your Route</h1>
        <p className="text-blue-200 text-sm">Search across 569 DTC bus routes</p>
      </div>

      {/* Search Form */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-5 space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Route name or number (e.g., 413, Ring Road)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dtc-blue"
            />
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="From stop"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dtc-blue"
            />
            <input
              type="text"
              placeholder="To stop"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dtc-blue"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-dtc-orange text-white py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            {loading ? 'Searching...' : 'Search Routes'}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-12 text-gray-500">Searching routes...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-500">No routes found. Try different keywords.</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">🚌</div>
            <p>Enter a route name, number, or stops above to search.</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">{results.length} route(s) found</p>
            <div className="space-y-3">
              {results.map((route) => (
                <Link
                  key={route._id}
                  href={`/track?routeId=${route._id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-dtc-blue text-white px-2 py-0.5 rounded-full font-semibold">
                          {route.url_route_id}
                        </span>
                        <span className="text-xs text-gray-400">{route.total_stages} stops</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{route.route_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {route.start_stage} → {route.end_stage}
                      </p>
                    </div>
                    <span className="text-dtc-orange text-sm font-medium">Track →</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
