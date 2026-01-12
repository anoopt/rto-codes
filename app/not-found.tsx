import Link from 'next/link';
import Header from '@/components/Header';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] relative flex items-center justify-center px-4 transition-colors duration-300">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-[var(--background)] via-[var(--card-bg)] to-[var(--background)] opacity-95" />

      {/* Home Link - Top Left */}
      <Header variant="minimal" />

      <div className="relative z-10 max-w-2xl w-full text-center">
        {/* 404 Large Text */}
        <h1 className="text-9xl font-bold text-[var(--muted-foreground)] mb-4">404</h1>

        {/* Main Message */}
        <h2 className="text-4xl font-bold text-[var(--foreground)] uppercase tracking-wide mb-4">Page Not Found</h2>

        <p className="font-body text-[var(--muted)] text-lg italic mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. The RTO code or page you&apos;re trying to access doesn&apos;t exist.
        </p>

        {/* Search Suggestion */}
        <div className="border border-[var(--card-border)] bg-[var(--card-bg)] p-8 mb-8">
          <h3 className="text-xl font-semibold text-[var(--foreground)] uppercase tracking-wide mb-4">Looking for an RTO code?</h3>
          <p className="font-body text-[var(--muted)] italic mb-6">
            Try searching for it from the homepage. We have information on 70 RTO codes across Karnataka.
          </p>

          {/* Popular RTOs */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Link
              href="/rto/ka-01"
              className="bg-[var(--background)] hover:bg-[var(--header-bg)] text-[var(--foreground)] px-4 py-3 font-medium transition border border-[var(--card-border)]"
            >
              KA-01 - Bangalore (Central)
            </Link>
            <Link
              href="/rto/ka-02"
              className="bg-[var(--background)] hover:bg-[var(--header-bg)] text-[var(--foreground)] px-4 py-3 font-medium transition border border-[var(--card-border)]"
            >
              KA-02 - Bangalore (North)
            </Link>
            <Link
              href="/rto/ka-03"
              className="bg-[var(--background)] hover:bg-[var(--header-bg)] text-[var(--foreground)] px-4 py-3 font-medium transition border border-[var(--card-border)]"
            >
              KA-03 - Bangalore (South)
            </Link>
            <Link
              href="/rto/ka-04"
              className="bg-[var(--background)] hover:bg-[var(--header-bg)] text-[var(--foreground)] px-4 py-3 font-medium transition border border-[var(--card-border)]"
            >
              KA-04 - Bangalore (East)
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 font-bold uppercase tracking-wider text-sm transition inline-block"
          >
            ← Go to Homepage
          </Link>
          <Link
            href="/about"
            className="bg-transparent text-[var(--foreground)] px-8 py-3 font-bold uppercase tracking-wider text-sm border border-[var(--card-border)] hover:bg-[var(--card-bg)] transition inline-block"
          >
            Learn More
          </Link>
        </div>

        {/* Additional Help */}
        <p className="text-[var(--muted-foreground)] mt-8 font-body italic">
          If you think this is an error, please{' '}
          <Link href="/contribute" className="text-cyan-400 hover:underline">
            let us know
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
