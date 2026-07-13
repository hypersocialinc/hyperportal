import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PORTAL } from "@/lib/portal.config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = `${PORTAL.name} — ${PORTAL.label}`;
const DESCRIPTION = "Confidential.";

// The OG image is fetched and cached by link unfurlers (Slack, iMessage, LinkedIn)
// outside the token gate, and cannot be retracted once cached. It must never carry
// metrics, dates, counterparty names, or anything recipient-specific.
export const metadata: Metadata = {
  metadataBase: new URL(PORTAL.url),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    url: "/",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

// Default to light mode. Only go dark if the visitor explicitly toggled to dark
// (persisted in localStorage) — OS prefers-color-scheme is intentionally ignored
// so the room presents the same, on-brand light look to a first-time viewer.
const themeInit = `(function(){try{var d=localStorage.getItem('theme')==='dark';document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
