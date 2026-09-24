// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Source_Serif_4, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/ui/toaster';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '600', '700'],
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://truthofgod.techtursolutions.com'),
  title: {
    default: 'Truth of God',
    template: '%s | Truth of God',
  },
  description: 'First Church of Our Lord Jesus Christ community platform.',
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/logo.jpg',
    apple: '/brand/logo.jpg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: 'Truth of God',
    images: ['/brand/logo.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#1B2B4B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${playfair.variable} ${sourceSerif.variable} ${cormorant.variable} font-body bg-white text-charcoal-800 antialiased`}
      >
        <Providers>
          <Navigation />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
