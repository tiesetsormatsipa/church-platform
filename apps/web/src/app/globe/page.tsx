import { CacheTags, type GeographyOverview } from '@church/shared';
import { Container } from '@church/ui/container';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/content/page-header';
import { GlobeExplorer } from '@/components/globe/globe-explorer';
import { publicApi, unwrap } from '@/lib/api/server';
import { getOrganization } from '@/lib/data';

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getOrganization();
  return {
    title: 'Where we are',
    description: `Every country and branch of ${organization.name}, on the globe.`,
    alternates: { canonical: '/globe' },
  };
}

async function loadGeography(): Promise<GeographyOverview> {
  const { client, fetch } = await publicApi({ tags: [CacheTags.branches], revalidate: 300 });
  return unwrap(await client.GET('/api/v1/geography', { fetch }));
}

export default async function GlobePage() {
  const overview = await loadGeography();
  const { totals } = overview;

  return (
    <>
      <PageHeader
        eyebrow="Where we are"
        title="The church on the globe"
        description={
          totals.branches === 0
            ? 'Branches will appear here as they are added.'
            : `${totals.branches} ${totals.branches === 1 ? 'branch' : 'branches'} in ${totals.countries} ${totals.countries === 1 ? 'country' : 'countries'}.`
        }
      />
      <Container className="py-8">
        <GlobeExplorer overview={overview} />
      </Container>
    </>
  );
}
