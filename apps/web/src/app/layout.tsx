import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { Providers } from '@/components/layout/providers';
import { getBranches, getOrganization } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { inter, sourceSerif } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getOrganization();
  const siteName = organization.shortName ?? organization.name;
  return {
    metadataBase: new URL(serverEnv.appOrigin),
    title: { default: siteName, template: `%s · ${siteName}` },
    description: organization.tagline ?? `News, events, sermons and branches of ${organization.name}.`,
    applicationName: siteName,
    openGraph: { type: 'website', siteName, locale: 'en_ZA' },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1116' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [organization, branches, cookieStore] = await Promise.all([getOrganization(), getBranches(), cookies()]);
  const theme = cookieStore.get('cp_theme')?.value;
  const themeClass = theme === 'dark' || theme === 'light' ? theme : undefined;

  return (
    <html lang="en-ZA" className={[inter.variable, sourceSerif.variable, themeClass].filter(Boolean).join(' ')}>
      <body className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <Providers>
          <a
            href="#main"
            className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <SiteHeader organization={organization} branches={branches} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter organization={organization} branches={branches} />
          <MobileTabBar />
        </Providers>
      </body>
    </html>
  );
}
