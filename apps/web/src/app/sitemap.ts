import type { MetadataRoute } from 'next';
import { publicApi } from '@/lib/api/server';
import { serverEnv } from '@/lib/env';

const STATIC_PATHS = ['/', '/feed', '/events', '/news', '/sermons', '/branches'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, serverEnv.appOrigin).toString();
  const pages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: url(path),
    changeFrequency: 'daily',
  }));
  try {
    const { client, fetch } = await publicApi({ revalidate: 3600 });
    const { data } = await client.GET('/api/v1/sitemap', { fetch });
    if (data) {
      for (const entry of [...data.branches, ...data.content]) {
        pages.push({ url: url(entry.path), lastModified: entry.updatedAt });
      }
    }
  } catch {
    // The static pages are still worth listing if the API is unreachable.
  }
  return pages;
}
