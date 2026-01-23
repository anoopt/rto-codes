import Link from 'next/link';
import Header from '@/components/Header';
import RTOImage from '@/components/RTOImage';
import { getVerifiedRTOs, getVerifiedRTOCodes } from '@/lib/rto-data';
import { hasRTOImage } from '@/lib/cloudinary';

// Get 4 random active RTOs at build time (outside component for lint compliance)
function getRandomActiveRTOs(count: number) {
  const activeRTOs = getVerifiedRTOs().filter(
    rto => rto.status !== 'not-in-use' && rto.status !== 'discontinued'
  );
  
  // Shuffle using Fisher-Yates
  const shuffled = [...activeRTOs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
}

// Pre-compute at module load (build time for static export)
const randomRTOs = getRandomActiveRTOs(4);

export default function NotFound() {
  // Get dynamic counts
  const totalRTOs = getVerifiedRTOCodes().length;

  return (
    <div className="min-h-screen bg-[var(--background)] relative transition-colors duration-300">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-[var(--background)] via-[var(--card-bg)] to-[var(--background)] opacity-95" />

      {/* Full Header with navigation */}
      <Header variant="full" />

      {/* Main content - below nav with padding for fixed header */}
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-12">
        <div className="max-w-2xl w-full text-center">
          {/* 404 Large Text */}
          <h1 className="text-9xl font-bold text-[var(--muted-foreground)] mb-4">404</h1>

          {/* Main Message */}
          <h2 className="text-4xl font-bold text-[var(--foreground)] uppercase tracking-wide mb-4">Page Not Found</h2>

          <p className="text-[var(--muted)] text-lg mb-8">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The RTO code or page you&apos;re trying to access doesn&apos;t exist.
          </p>

          {/* Search Suggestion */}
          <div className="border border-[var(--card-border)] bg-[var(--card-bg)] p-8 mb-8">
            <h3 className="text-xl font-semibold text-[var(--foreground)] uppercase tracking-wide mb-4">Looking for an RTO code?</h3>
            <p className="text-[var(--muted)] mb-6">
              Try searching for it from the homepage. We have information on{' '}
              <span className="text-[var(--accent)] font-bold">{totalRTOs}</span> RTO codes.
            </p>

            {/* Random RTOs Grid - Same style as homepage tiles */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {randomRTOs.map((rto) => {
                const rtoHasImage = hasRTOImage(rto.code);

                return (
                  <Link
                    key={rto.code}
                    href={`/rto/${rto.code.toLowerCase()}`}
                    className={`block aspect-square border border-[var(--card-border)] relative overflow-hidden group transition-all duration-200 bg-[var(--card-bg)] ${
                      rtoHasImage
                        ? 'hover:bg-[var(--card-bg)]'
                        : 'hover:bg-[var(--foreground)]'
                    }`}
                  >
                    {/* Background Image from Cloudinary */}
                    <RTOImage rtoCode={rto.code} city={rto.city} variant="tile" hasImage={rtoHasImage} />

                    {/* Overlay for text readability */}
                    {rtoHasImage && (
                      <div className="absolute inset-0 transition-colors duration-200 pointer-events-none bg-white/60 group-hover:bg-white/70 dark:bg-black/40 dark:group-hover:bg-black/50" />
                    )}

                    {/* RTO Code and City - Centered */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-2">
                      <span className={`text-3xl sm:text-4xl font-bold tracking-tight uppercase drop-shadow-lg transition-colors duration-200 ${
                        rtoHasImage
                          ? 'text-slate-900 dark:text-white'
                          : 'text-[var(--foreground)] group-hover:text-[var(--background)]'
                      }`}>
                        {rto.code}
                      </span>
                      <span className={`text-xs sm:text-sm font-medium uppercase tracking-wider drop-shadow-md mt-1 truncate max-w-full text-center ${
                        rtoHasImage
                          ? 'text-slate-800 dark:text-white'
                          : 'text-[var(--muted-foreground)] group-hover:text-[var(--background)]/80'
                      }`}>
                        {rto.city}
                      </span>
                    </div>
                  </Link>
                );
              })}
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
          <p className="text-[var(--muted-foreground)] mt-8">
            If you think this is an error, please{' '}
            <Link href="/contribute" className="text-cyan-400 hover:underline">
              let us know
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
