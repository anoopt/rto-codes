import Link from 'next/link';
import Header from '@/components/Header';

export const metadata = {
  title: 'About | RTO Codes Karnataka',
  description: 'Learn about the RTO Codes Karnataka project, its technology stack, and data sources.',
};

export default function AboutPage() {
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
            About
          </h1>

          {/* Intro Text */}
          <p className="text-[var(--muted)] text-lg leading-relaxed mb-6">
            Every vehicle in India has a unique registration number. Some make sense if you know the city
            or the RTO office name and others, well, what the heck?
          </p>

          <p className="text-[var(--muted)] text-lg leading-relaxed mb-8">
            Turns out there&apos;s usually a reasonable explanation. Knowing what each RTO code stands for
            isn&apos;t super useful, but it sure can be fun.
          </p>

          {/* Divider */}
          <hr className="border-[var(--card-border)] mb-8" />

          {/* Maintainer */}
          <p className="text-[var(--muted)] text-lg mb-4">
            This site is maintained by{' '}
            <a
              href="https://github.com/anoopt"
              className="text-[var(--accent)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anoop T
            </a>.
          </p>

          <p className="text-[var(--muted)] text-lg mb-6">
            Like this project?{' '}
            <a
              href="https://www.buymeacoffee.com/anoopt"
              className="text-[var(--accent)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy me a coffee
            </a>.
          </p>

          {/* Coffee Icon */}
          <div className="text-3xl mb-6">☕</div>

          <p className="text-[var(--muted-foreground)] text-sm mb-8">
            Big thanks to{' '}
            <a
              href="https://airportcod.es"
              className="text-[var(--accent)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              airportcod.es
            </a>{' '}
            for the inspiration.
          </p>

          {/* Divider */}
          <hr className="border-[var(--card-border)] mb-8" />

          {/* Stats */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[var(--foreground)] uppercase tracking-wide mb-6">
              RTO Codes Status
            </h2>
            <div className="space-y-2 text-[var(--muted)]">
              <p>
                <span className="text-[var(--accent)] font-bold text-2xl">80+</span>{' '}
                RTO codes
              </p>
              <p>
                from{' '}
                <span className="text-[var(--accent)] font-bold text-2xl">30+</span>{' '}
                districts
              </p>
              <p>
                across{' '}
                <span className="text-[var(--accent)] font-bold text-2xl">2</span>{' '}
                states (Karnataka &amp; Goa)
              </p>
            </div>
            <p className="text-[var(--muted-foreground)] text-sm mt-4">
              More states coming soon!
            </p>
          </div>

          {/* Divider */}
          <hr className="border-[var(--card-border)] mb-8" />

          {/* Data Sources */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[var(--foreground)] uppercase tracking-wide mb-4">
              Data Sources
            </h2>
            <p className="text-[var(--muted)] text-sm leading-relaxed mb-4">
              RTO information sourced from:
            </p>
            <ul className="text-[var(--muted)] text-sm leading-relaxed space-y-2 mb-4">
              <li>
                •{' '}
                <a
                  href="https://etc.karnataka.gov.in/General/rto_office.aspx"
                  className="text-[var(--accent)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Karnataka Transport Department
                </a>
              </li>
              <li>
                •{' '}
                <a
                  href="https://vahan.parivahan.gov.in/"
                  className="text-[var(--accent)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Parivahan (Ministry of Road Transport)
                </a>
              </li>
              <li>
                •{' '}
                <a
                  href="https://en.wikipedia.org/wiki/List_of_Regional_Transport_Office_districts_in_India"
                  className="text-[var(--accent)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wikipedia
                </a>
              </li>
            </ul>
            <p className="text-[var(--muted)] text-sm leading-relaxed mb-4">
              Additional data enrichment powered by{' '}
              <a
                href="https://deepmind.google/technologies/gemini/"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Gemini AI
              </a>.
            </p>
            <p className="text-[var(--muted)] text-sm leading-relaxed">
              District maps sourced from{' '}
              <a
                href="https://commons.wikimedia.org/"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Wikimedia Commons
              </a>{' '}
              under Creative Commons license.
            </p>
          </div>

          {/* Divider */}
          <hr className="border-[var(--card-border)] mb-8" />

          {/* Contribute CTA */}
          <p className="text-[var(--muted)] text-xl mb-6">
            &quot;Hey, you left [my RTO] off the list!&quot;
          </p>

          <Link
            href="/contribute"
            className="inline-block bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-8 py-3 font-bold uppercase tracking-wider text-sm transition-colors mb-8"
          >
            Contribute
          </Link>

          {/* Back Button */}
          <div>
            <Link
              href="/"
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors font-bold tracking-wider text-sm uppercase"
            >
              RTO Codes
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
