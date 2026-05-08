// Skeleton loading components for SmartDTC

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 bg-gray-50">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div key={colIdx} className={`h-4 bg-gray-100 rounded flex-1 ${colIdx === 0 ? 'max-w-[80px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-4/6" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="w-10 h-10 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-20 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-32" />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="animate-pulse bg-gray-200 rounded-xl h-96 flex items-center justify-center">
      <div className="text-gray-400 text-center">
        <div className="text-4xl mb-2">🗺️</div>
        <p className="text-sm">Loading map...</p>
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-dtc-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}
