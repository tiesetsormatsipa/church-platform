import type { Metadata } from 'next';
import { ContentDetailView } from '@/components/content/content-detail';
import { JsonLd } from '@/components/content/json-ld';
import { contentMetadata, loadContent } from '@/lib/content';
import { getOrganization } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { contentJsonLd } from '@/lib/json-ld';

export async function generateMetadata({ params }: PageProps<'/news/[slug]'>): Promise<Metadata> {
  return contentMetadata(await loadContent('/news', (await params).slug));
}

export default async function NewsArticlePage({ params }: PageProps<'/news/[slug]'>) {
  const [item, organization] = await Promise.all([
    loadContent('/news', (await params).slug),
    getOrganization(),
  ]);
  return (
    <>
      <JsonLd
        data={contentJsonLd(item, {
          origin: serverEnv.appOrigin,
          organizationName: organization.name,
        })}
      />
      <ContentDetailView item={item} />
    </>
  );
}
