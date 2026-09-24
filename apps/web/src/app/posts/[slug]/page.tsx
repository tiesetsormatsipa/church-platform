import type { Metadata } from 'next';
import { ContentDetailView } from '@/components/content/content-detail';
import { JsonLd } from '@/components/content/json-ld';
import { contentMetadata, loadContent } from '@/lib/content';
import { getOrganization } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { contentJsonLd } from '@/lib/json-ld';

export async function generateMetadata({ params }: PageProps<'/posts/[slug]'>): Promise<Metadata> {
  return contentMetadata(await loadContent('/posts', (await params).slug));
}

export default async function PostPage({ params }: PageProps<'/posts/[slug]'>) {
  const [item, organization] = await Promise.all([loadContent('/posts', (await params).slug), getOrganization()]);
  return (
    <>
      <JsonLd data={contentJsonLd(item, { origin: serverEnv.appOrigin, organizationName: organization.name })} />
      <ContentDetailView item={item} />
    </>
  );
}
