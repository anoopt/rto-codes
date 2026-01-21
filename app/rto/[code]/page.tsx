import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRTOByCode, getAllRTOs, getVerifiedRTOCodes, getDistrictToRTOsMap, getRTOsByDistrict } from '@/lib/rto-data';
import { getStateMapSvg, getStateFolderByCode, getStateConfig, getAvailableStates } from '@/lib/state-config';
import { hasRTOImage } from '@/lib/cloudinary';
import { isOSMEnabled } from '@/lib/feature-flags';
import ShuffleButton from '@/components/ShuffleButton';
import RTONavigation from '@/components/RTONavigation';
import SwipeHandler from '@/components/SwipeHandler';
import SwipeHint from '@/components/SwipeHint';
import MapSectionWrapper from '@/components/MapSectionWrapper';
import Footer from '@/components/Footer';
import RTOHeroImage from '@/components/RTOHeroImage';
import { CloseIcon, WarningIcon, MapIcon, LocationIcon, PhoneIcon, EmailIcon } from '@/components/icons';

// Feature flag for district map
const ENABLE_DISTRICT_MAP = process.env.NEXT_PUBLIC_ENABLE_DISTRICT_MAP === 'true';
// Check if OSM is enabled at module level for pre-loading optimization
const OSM_ENABLED = isOSMEnabled();

// Pre-load map content and config by state
const stateData: Record<string, {
  svgContent: string | null;
  districtMapping: Record<string, string>;
  svgDistrictIds: string[];
}> = {};

if (ENABLE_DISTRICT_MAP) {
  // Dynamically load all available state maps
  const availableStates = getAvailableStates();

  for (const stateName of availableStates) {
    const stateConfig = getStateConfig(stateName);
    // Only load the map if it exists (getStateMapSvg returns null if not found)
    const svgContent = getStateMapSvg(stateName);

    if (stateConfig) {
      stateData[stateName] = {
        svgContent,  // May be null if map doesn't exist
        districtMapping: stateConfig.districtMapping || {},
        svgDistrictIds: stateConfig.svgDistrictIds || []
      };
    }
  }
}

// Pre-compute district to RTOs map for interactive map navigation
const districtRTOsMap = ENABLE_DISTRICT_MAP ? getDistrictToRTOsMap() : null;

// Convert to simplified format for client component
const clientDistrictRTOsMap = districtRTOsMap
  ? Object.fromEntries(
    Object.entries(districtRTOsMap).map(([district, rtos]) => [
      district,
      rtos.map(rto => ({
        code: rto.code,
        region: rto.region,
        isInactive: rto.status === 'not-in-use' || rto.status === 'discontinued',
        isDistrictHeadquarter: rto.isDistrictHeadquarter
      }))
    ])
  )
  : null;

export async function generateStaticParams() {
  const rtos = getAllRTOs();
  return rtos.map((rto) => ({
    code: rto.code.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rto = getRTOByCode(code);

  if (!rto || !rto.region) {
    return {
      title: 'RTO Code Not Found',
    };
  }

  const isNotInUse = rto.status === 'not-in-use' || rto.status === 'discontinued';
  const description = isNotInUse
    ? `${rto.code} RTO code for ${rto.region}, ${rto.city}, ${rto.state} is not in use. ${rto.note || ''}`
    : `Details about RTO code ${rto.code} for ${rto.region}, ${rto.city}, ${rto.state}. ${rto.description || ''}`.trim();

  return {
    title: isNotInUse ? `${rto.code} - Not In Use` : `${rto.code} - ${rto.region}`,
    description,
    openGraph: {
      title: isNotInUse
        ? `${rto.code} - Not In Use | ${rto.state} RTO Codes`
        : `${rto.code} - ${rto.region} | ${rto.state} RTO Codes`,
      description,
      type: 'article',
      url: `/rto/${rto.code.toLowerCase()}`,
    },
    twitter: {
      card: 'summary',
      title: isNotInUse ? `${rto.code} - Not In Use` : `${rto.code} - ${rto.region}`,
      description,
    },
  };
}

// Generate JSON-LD structured data for SEO
function generateJsonLd(rto: NonNullable<ReturnType<typeof getRTOByCode>>) {
  // Get site URL from environment, fallback to localhost for development
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOffice',
    name: `RTO ${rto.code} - ${rto.region}`,
    description: rto.description || `Regional Transport Office for ${rto.region}, ${rto.city}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: rto.address,
      addressLocality: rto.city,
      addressRegion: rto.state,
      postalCode: rto.pinCode,
      addressCountry: 'IN',
    },
    ...(rto.phone && { telephone: rto.phone.split(',')[0].trim() }),
    ...(rto.email && { email: rto.email }),
    areaServed: {
      '@type': 'AdministrativeArea',
      name: rto.district || rto.city,
    },
    url: `${siteUrl}/rto/${rto.code.toLowerCase()}`,
    identifier: rto.code,
  };
}

export default async function RTODetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rto = getRTOByCode(code);

  if (!rto) {
    notFound();
  }

  // Check if this is a placeholder (empty data)
  const isPlaceholder = !rto.region || rto.region.trim() === '';

  // Check if this RTO code is not in use
  const isNotInUse = rto.status === 'not-in-use' || rto.status === 'discontinued';

  // Get all verified RTO codes (includes both active and inactive)
  // Sorted with active RTOs first, then inactive ones (matching homepage order)
  const allRTOCodes = getVerifiedRTOCodes();

  // Generate JSON-LD for SEO (only for verified RTOs)
  const jsonLd = !isPlaceholder ? generateJsonLd(rto) : null;

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)] transition-colors duration-300">
      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Hero Background Image from Cloudinary - only rendered if available */}
      <RTOHeroImage rtoCode={rto.code} city={rto.city} hasImage={hasRTOImage(rto.code)} isInactive={isNotInUse} />

      {/* Background with subtle gradient overlay - reduced opacity to show image */}
      <div className="absolute inset-0 bg-linear-to-br from-[var(--background)] via-[var(--card-bg)] to-[var(--background)] opacity-70 z-[1]" />

      {/* Main Content - Centered with Swipe Support */}
      <SwipeHandler currentCode={code} allCodes={allRTOCodes}>
        <main id="main-content" className="grow flex items-center justify-center px-4 py-16 relative z-10">
          <div className="relative w-full max-w-2xl">
            {/* Content Box with border - min-height for consistency */}
            <div className="relative border border-[var(--card-border)] bg-transparent p-8 md:p-12 pt-14 md:pt-16 min-h-[320px] md:min-h-[400px] flex flex-col justify-center">
              {/* Top Navigation Bar */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between">
                {/* Shuffle Button - Top Left */}
                <ShuffleButton
                  currentCode={code}
                  allCodes={allRTOCodes}
                  className=""
                />

                {/* Navigation Controls - Top Center/Right */}
                <div className="flex items-center gap-2">
                  <RTONavigation
                    key={code}
                    currentCode={code}
                    allCodes={allRTOCodes}
                    className=""
                  />

                  {/* Close Button */}
                  <Link
                    href={`/#${rto.code.toLowerCase()}`}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[var(--card-bg)] transition-all group relative cursor-pointer"
                    aria-label="Close and return to homepage"
                  >
                    <CloseIcon />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-[var(--tooltip-bg)] text-[var(--tooltip-text)] text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-50 after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-ml-[5px] after:border-[5px] after:border-solid after:border-b-[var(--tooltip-bg)] after:border-x-transparent after:border-t-transparent">
                      Close
                    </span>
                  </Link>
                </div>
              </div>

              {isPlaceholder ? (
                // Placeholder state
                <div className="text-center py-8">
                  <h1 className="text-6xl md:text-8xl font-bold text-[var(--foreground)] tracking-tight mb-6">
                    {rto.code.toUpperCase()}
                  </h1>

                  <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)] uppercase tracking-widest mb-4">
                    Data Coming Soon
                  </h2>

                  <p className="text-[var(--muted-foreground)] text-sm uppercase tracking-wide">
                    Karnataka • India
                  </p>
                </div>
              ) : isNotInUse ? (
                // Not-in-use RTO code state
                <div className="text-center py-4">
                  {/* Large RTO Code with strikethrough effect */}
                  <h1 className="text-7xl md:text-9xl font-bold text-[var(--muted-foreground)] tracking-tight mb-6 relative">
                    <span className="opacity-40">{rto.code.toUpperCase()}</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-1 bg-[var(--muted-foreground)] opacity-30 -rotate-12"></div>
                    </div>
                  </h1>

                  {/* Status Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <WarningIcon className="w-3.5 h-3.5 text-amber-500/80 shrink-0 -translate-y-[1px]" />
                    <span className="text-amber-500/80 text-xs font-medium uppercase tracking-wider">
                      Not In Use
                    </span>
                  </div>

                  {/* Region Name */}
                  <h2 className="text-lg md:text-xl font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-3">
                    {rto.region}
                  </h2>

                  {/* Location */}
                  <p className="text-[var(--muted-foreground)] text-sm uppercase tracking-widest mb-6">
                    {rto.city}{rto.district && rto.district !== rto.city ? `, ${rto.district}` : ''} • {rto.state}
                  </p>

                  {/* Description */}
                  {rto.description && (
                    <p className="text-[var(--muted)] text-base leading-relaxed max-w-lg mx-auto mb-6">
                      {rto.description.replace(/\*/g, '')}
                    </p>
                  )}

                  {/* Note with redirect link */}
                  {rto.note && (
                    <div className="mt-6 p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg max-w-md mx-auto">
                      <p className="text-[var(--muted-foreground)] text-sm">
                        {rto.redirectTo ? (
                          <>
                            This RTO code is not in use. For {rto.city} registrations, please refer to{' '}
                            <Link href={`/rto/${rto.redirectTo.toLowerCase()}`} className="text-[var(--foreground)] font-medium hover:underline">
                              {rto.redirectTo}
                            </Link>.
                          </>
                        ) : (
                          rto.note
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Full RTO details
                <div className="text-center py-4">
                  {/* Large RTO Code */}
                  <h1 className="text-7xl md:text-9xl font-bold text-[var(--foreground)] tracking-tight mb-6">
                    {rto.code.toUpperCase()}
                  </h1>

                  {/* Region Name */}
                  <h2 className="text-lg md:text-xl font-bold text-[var(--foreground)] uppercase tracking-widest mb-3">
                    {rto.region}
                  </h2>

                  {/* Location */}
                  <p className="text-[var(--muted-foreground)] text-sm uppercase tracking-widest mb-8">
                    {rto.city}{rto.district && rto.district !== rto.city ? `, ${rto.district}` : ''} • {rto.state}
                  </p>

                  {/* Description */}
                  {rto.description && (
                    <p className="text-[var(--muted)] text-base leading-relaxed max-w-lg mx-auto">
                      {rto.description.replace(/\*/g, '')}
                    </p>
                  )}

                  {/* District Map - Feature flagged with interactive navigation */}
                  {/* Renders OSM map when NEXT_PUBLIC_OSM_ENABLED is true, otherwise SVG map.
                      Only renders if ENABLE_DISTRICT_MAP or OSM_ENABLED is true and RTO has a district. */}
                  {(ENABLE_DISTRICT_MAP || OSM_ENABLED) && rto.district && (() => {
                    const stateFolderName = getStateFolderByCode(rto.stateCode);
                    const stateInfo = stateFolderName ? stateData[stateFolderName] : null;
                    // Get RTOs in this district for OSM markers
                    const districtRTOs = getRTOsByDistrict(rto.district, rto.state);
                    return (
                      <MapSectionWrapper
                        rto={{ code: rto.code, state: rto.state, stateCode: rto.stateCode, district: rto.district }}
                        svgContent={stateInfo?.svgContent}
                        districtMapping={stateInfo?.districtMapping || {}}
                        svgDistrictIds={stateInfo?.svgDistrictIds || []}
                        districtRTOsMap={clientDistrictRTOsMap || undefined}
                        districtRTOs={districtRTOs}
                      />
                    );
                  })()}

                  {/* Coverage Area */}
                  {rto.coverage && (
                    <div className="inline-flex items-start gap-2 mt-6 text-[var(--muted-foreground)] text-sm max-w-md mx-auto">
                      <MapIcon className="shrink-0 mt-0.5" />
                      <span>
                        {rto.coverage}
                      </span>
                    </div>
                  )}

                  {/* Jurisdiction Areas */}
                  {rto.jurisdictionAreas && rto.jurisdictionAreas.length > 0 && (
                    <div className="mt-6 text-[var(--muted-foreground)] text-sm max-w-md mx-auto">
                      <div className="flex flex-wrap justify-center items-center gap-2">
                        {rto.jurisdictionAreas.map((area: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center justify-center px-3 pt-2 pb-1.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full text-xs uppercase tracking-wide leading-none"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  {(rto.address || rto.phone || rto.email) && (
                    <div className="mt-8 pt-6 border-t border-[var(--card-border)] text-center max-w-md mx-auto">
                      <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-4 text-center">
                        Contact Information
                      </h3>

                      {rto.address && (
                        <div className="flex items-center justify-center gap-3 mb-3 text-sm">
                          <LocationIcon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                          <span className="text-[var(--muted)]">
                            {rto.address}{rto.pinCode ? ` - ${rto.pinCode}` : ''}
                          </span>
                        </div>
                      )}

                      {rto.phone && (
                        <div className="flex items-center justify-center gap-3 mb-3 text-sm">
                          <PhoneIcon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                          <a href={`tel:${rto.phone.split(',')[0].trim()}`} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                            {rto.phone}
                          </a>
                        </div>
                      )}

                      {rto.email && (
                        <div className="flex items-center justify-center gap-3 text-sm">
                          <EmailIcon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                          <a href={`mailto:${rto.email}`} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                            {rto.email}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Division Badge */}
                  {rto.division && (
                    <div className="mt-6 text-center">
                      <span className="inline-flex items-center justify-center px-4 pt-2 pb-1.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded text-xs text-[var(--muted-foreground)] uppercase tracking-wider leading-none">
                        {rto.division}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </SwipeHandler>

      {/* Swipe Hint for mobile - shows once */}
      <SwipeHint />

      {/* Footer - Bottom */}
      <Footer className="relative z-10" />
    </div>
  );
}
