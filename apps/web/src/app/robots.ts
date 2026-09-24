import type { MetadataRoute } from 'next';
import { serverEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/profile', '/notifications', '/api/', '/internal/', '/search'],
      },
    ],
    sitemap: new URL('/sitemap.xml', serverEnv.appOrigin).toString(),
  };
}
