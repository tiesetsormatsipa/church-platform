import type { NextConfig } from 'next';

type Redirect = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>[number];

/**
 * URL compatibility with the previous site(s). See docs/ARCHITECTURE.md §7.3.
 * Add live-site URLs here as they become known; no other code needs to change.
 * Branch pages addressed by legacy UUID are handled in app/branches/[slug]/page.tsx.
 */
export const legacyRedirects: Redirect[] = [
  { source: '/auth/signin', destination: '/sign-in', permanent: true },
  { source: '/auth/callback', destination: '/sign-in', permanent: false },
  { source: '/regions', destination: '/branches', permanent: true },
  // Announcements, posts and baptism stories have detail pages only; the feed lists them.
  { source: '/posts', destination: '/feed', permanent: false },
  { source: '/announcements', destination: '/feed?types=announcement', permanent: true },
  // Modules that were never launched in the legacy app (ADR-016). /songs is a real page now,
  // so it is no longer parked here; jobs and messaging follow as they are built.
  { source: '/marketplace/:path*', destination: '/', permanent: false },
  { source: '/marketplace', destination: '/', permanent: false },
  { source: '/jobs/:path*', destination: '/', permanent: false },
  { source: '/jobs', destination: '/', permanent: false },
  { source: '/messaging', destination: '/', permanent: false },
];
