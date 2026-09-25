import {
  CacheTags,
  CONTENT_COLLECTION_LABEL,
  type SongsPage as SongsPageData,
} from '@church/shared';
import { Container } from '@church/ui/container';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/content/page-header';
import { SongLibrary } from '@/components/songs/song-library';
import { publicApi, unwrap } from '@/lib/api/server';
import { branchParam, type SearchParams } from '@/lib/context';
import { getOrganization } from '@/lib/data';

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const collection = one(params.collection);
  const organization = await getOrganization();
  const label =
    collection && collection in CONTENT_COLLECTION_LABEL
      ? CONTENT_COLLECTION_LABEL[collection as keyof typeof CONTENT_COLLECTION_LABEL]
      : null;
  return {
    title: label ? `Songs · ${label}` : 'Songs',
    description: `Songs sung across ${organization.name}, with the choir recordings from Truth of God and the Holy Convocation.`,
    alternates: { canonical: '/songs' },
  };
}

async function loadSongs(params: SearchParams): Promise<SongsPageData> {
  const { client, fetch } = await publicApi({ tags: [CacheTags.content] });
  return unwrap(
    await client.GET('/api/v1/songs', {
      params: {
        query: {
          branch: branchParam(params),
          collection: one(params.collection) as never,
          language: one(params.language),
          album: one(params.album),
          country: one(params.country),
          year: one(params.year) as never,
          limit: 50,
        },
      },
      fetch,
    }),
  );
}

export default async function SongsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = await loadSongs(params);

  return (
    <>
      <PageHeader
        eyebrow="Songs"
        title="The songs we sing"
        description="From the branches, from Truth of God, and from the Holy Convocation."
      />
      <Container className="py-8">
        <SongLibrary page={page} />
      </Container>
    </>
  );
}
