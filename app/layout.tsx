import type { Metadata, Viewport } from "next";
import { Josefin_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import DevWarningBanner from "@/components/DevWarningBanner";
import PersistentHeader from "@/components/PersistentHeader";
import WebMCPTools from "@/components/WebMCPTools";
import { getVerifiedRTOs } from "@/lib/rto-data";
import "./globals.css";

const josefinSans = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-josefin",
  display: "swap",
});

// Get site URL from environment variable, fallback to localhost for development
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RTO Codes India - Regional Transport Office Codes Directory",
    template: "%s | RTO Codes India",
  },
  description:
    "A comprehensive, searchable database of RTO (Regional Transport Office) codes in India. Find detailed information about RTO locations and codes across all states and union territories.",
  keywords: [
    "RTO codes",
    "India RTO",
    "regional transport office",
    "vehicle registration codes",
    "India RTO list",
    "transport office codes",
    "RTO codes India",
  ],
  authors: [{ name: "RTO Codes India" }],
  creator: "RTO Codes India",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "RTO Codes India",
    title: "RTO Codes India - Regional Transport Office Codes Directory",
    description:
      "A comprehensive, searchable database of RTO codes in India. Find detailed information about RTO locations and codes across various states.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RTO Codes India - Regional Transport Office Codes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RTO Codes India - Regional Transport Office Codes Directory",
    description:
      "A comprehensive, searchable database of RTO codes in India.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={josefinSans.variable} suppressHydrationWarning>
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
        <ThemeProvider>
          {/* Development warning banner for missing env vars */}
          <DevWarningBanner />
          {/* Skip to main content link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--card-bg)] focus:text-[var(--foreground)] focus:rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            Skip to main content
          </a>
          {/* Persistent header across all pages */}
          <PersistentHeader />
          {/* Register WebMCP tools for in-browser AI agents (Chrome 146+) */}
          <WebMCPTools rtos={getVerifiedRTOs()} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
