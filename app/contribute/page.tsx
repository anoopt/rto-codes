import Link from 'next/link';
import Header from '@/components/Header';

export const metadata = {
  title: 'Contribute | RTO Codes India',
  description: 'Learn how to contribute to the RTO Codes India project by adding RTO data, state maps, or improving the code.',
};

export default function ContributePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] relative transition-colors duration-300">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-[var(--background)] via-[var(--card-bg)] to-[var(--background)] opacity-95" />

      {/* Home Link - Top Left */}
      <Header variant="minimal" />

      {/* Main Content */}
      <main id="main-content" className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-xl w-full text-center">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--foreground)] uppercase tracking-wide mb-8">
            Contribute
          </h1>

          {/* Intro Text */}
          <p className="text-[var(--muted)] text-lg leading-relaxed mb-6">
            There are lots of RTO offices across India. We currently have Karnataka and Goa,
            and we&apos;d love your help to add more states!
          </p>

          <p className="text-[var(--muted)] text-lg leading-relaxed mb-8">
            A few ways you can help make the site more awesome:
          </p>

          {/* Ways to Contribute */}
          <ul className="text-center text-lg space-y-4 mb-10">
            <li className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">Add RTO Data</strong> – Submit JSON files for RTOs not yet in the database via{' '}
              <a
                href="https://github.com/anoopt/rto-codes/blob/main/CONTRIBUTING.md"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>.
            </li>
            <li className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">Add State Maps</strong> – Contribute SVG district maps from{' '}
              <a
                href="https://commons.wikimedia.org/"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wikimedia Commons
              </a>.
            </li>
            <li className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">Fix Data</strong> – Spot an error? Open an{' '}
              <a
                href="https://github.com/anoopt/rto-codes/issues/new/choose"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                issue on GitHub
              </a>.
            </li>
            <li className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">Spread the Word</strong> – Share on{' '}
              <a
                href="https://bsky.app/profile/anoopt.bsky.social"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bluesky
              </a>{' '}
              or{' '}
              <a
                href="https://twitter.com/AnoopTatti"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                X/Twitter
              </a>.
            </li>
            <li className="text-[var(--muted)]">
              <strong className="text-[var(--foreground)]">Support</strong> – Like this project?{' '}
              <a
                href="https://www.buymeacoffee.com/anoopt"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy me a coffee ☕
              </a>
            </li>
          </ul>

          {/* Contribution Guide CTA */}
          <a
            href="https://github.com/anoopt/rto-codes/blob/main/CONTRIBUTING.md"
            className="inline-block bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-8 py-3 font-bold uppercase tracking-wider text-sm transition-colors mb-8"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Contribution Guide
          </a>

          {/* Divider */}
          <hr className="border-[var(--card-border)] mb-8" />

          {/* Tagline */}
          <p className="text-[var(--muted)] text-xl mb-8">
            Drive safe, friends.
          </p>

          {/* Back Button */}
          <Link
            href="/"
            className="inline-block border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white px-8 py-3 font-bold uppercase tracking-wider text-sm transition-colors"
          >
            Back to RTO Codes
          </Link>
        </div>
      </main>
    </div>
  );
}
