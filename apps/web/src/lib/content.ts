import 'server-only';
import { CacheTags, type ContentDetail, type LegacyEntity } from '@church/shared';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { publicApi, unwrap } from './api/server';

/** Slugs and legacy ids we are willing to look up (anything else is a 404 without an API call). */
const LOOKUP = /^[a-z0-9][a-z0-9-]{0,199}$/;

export const getContent = cache(async (slug: string): Promise<ContentDetail | null> => {
  const { client, fetch } = await publicApi({
    tags: [CacheTags.content, CacheTags.contentItem(slug)],
  });
  const result = await client.GET('/api/v1/content/{slug}', { params: { path: { slug } }, fetch });
  if (result.response.status === 404) return null;
  return unwrap(result);
});

/** Current path of a record imported from the legacy system, or null. */
export async function resolveLegacyPath(
  entity: LegacyEntity,
  legacyId: string,
): Promise<string | null> {
  const { client, fetch } = await publicApi({ revalidate: 3600, tags: [CacheTags.content] });
  const result = await client.GET('/api/v1/legacy-links/{entity}/{legacyId}', {
    params: { path: { entity, legacyId } },
    fetch,
  });
  return result.data?.path ?? null;
}

/**
 * Load an item for a typed route (`/events/…`, `/news/…`, `/sermons/…`, `/posts/…`).
 * Items requested under the wrong prefix, and legacy ids, redirect to the canonical URL.
 */
export async function loadContent(prefix: string, rawSlug: string): Promise<ContentDetail> {
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  if (!LOOKUP.test(slug)) notFound();
  const item = await getContent(slug);
  if (!item) {
    const legacy = await resolveLegacyPath('content', slug);
    if (legacy) permanentRedirect(legacy);
    notFound();
  }
  if (!item.path.startsWith(`${prefix}/`) || slug !== rawSlug) permanentRedirect(item.path);
  return item;
}

export function contentMetadata(item: ContentDetail): Metadata {
  const title = item.seoTitle ?? item.title;
  const description = item.seoDescription ?? (item.summary || undefined);
  const images = item.cover
    ? [
        {
          url: item.cover.url,
          width: item.cover.width ?? undefined,
          height: item.cover.height ?? undefined,
          alt: item.cover.alt ?? '',
        },
      ]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: item.path },
    openGraph: {
      type: 'article',
      title,
      description,
      url: item.path,
      images,
      publishedTime: item.publishedAt,
      modifiedTime: item.updatedAt,
      authors: item.authorName ? [item.authorName] : undefined,
      tags: item.tags.map((t) => t.name),
    },
  };
}
