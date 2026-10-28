import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, Montserrat, Space_Grotesk } from "next/font/google";
import { appUrl } from "@/lib/server/config";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// The home page's headlines: a soft serif with the warmth of a café menu board.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// The wordmark: the geometric capitals of the brand's sign.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const DESCRIPTION =
  "Crema Cost Planner is the back office for independent cafés: monthly costs, the true cost and price of every cup, staff, break-even and profit, in one calm place.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Crema Cost Planner · The numbers behind every cup", template: "%s · Crema" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Crema Cost Planner",
    title: "Crema Cost Planner · The numbers behind every cup",
    description: DESCRIPTION,
    images: [{ url: "/home/og.jpg", width: 1200, height: 630, alt: "A bright Nordic café with an espresso machine under a Crema sign" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#f6f3ee" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} ${fraunces.variable} ${montserrat.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
