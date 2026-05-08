import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl mb-4">🚌</div>
      <h1 className="text-6xl font-bold text-dtc-blue">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mt-4">Page Not Found</h2>
      <p className="text-gray-500 mt-2 max-w-md">
        Looks like this bus took a different route. The page you're looking for doesn't exist.
      </p>
      <div className="flex gap-4 mt-8">
        <Link
          href="/"
          className="px-6 py-2.5 bg-dtc-blue text-white rounded-lg font-semibold hover:bg-blue-900 transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/track"
          className="px-6 py-2.5 border border-dtc-blue text-dtc-blue rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          Track a Bus
        </Link>
      </div>
    </div>
  );
}
