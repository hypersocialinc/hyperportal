import type { Metadata } from "next";
import "./globals.css";

// Static, counterparty-neutral metadata. Link unfurlers (Slack, iMessage) cache
// the OG image outside the token gate and forever — it must never carry a room
// name, metrics, or recipient-specific anything.
export const metadata: Metadata = {
  title: "Hyperportal",
  description: "Confidential.",
  robots: { index: false, follow: false },
};

const themeInit = `(function(){try{var d=localStorage.getItem('theme')==='dark';document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
