import 'server-only';
import type { components } from '@church/api-client';
import { CacheTags } from '@church/shared';
import { cache } from 'react';
import { publicApi, unwrap } from './api/server';

export type PublicOrganization = components['schemas']['PublicOrganization'];
export type BranchSummary = components['schemas']['BranchSummary'];

const FALLBACK_ORGANIZATION: PublicOrganization = {
  name: 'Church',
  shortName: null,
  tagline: null,
  description: null,
  email: null,
  phone: null,
  websiteUrl: null,
  timezone: 'Africa/Johannesburg',
  locale: 'en-ZA',
  logo: null,
  registrationOpen: true,
  socialLinks: {},
};

/** Organisation details for the shell. Falls back to defaults so the layout never fails. */
export const getOrganization = cache(async (): Promise<PublicOrganization> => {
  try {
    const { client, fetch } = await publicApi({ revalidate: 300, tags: [CacheTags.organization] });
    return unwrap(await client.GET('/api/v1/organization', { fetch }));
  } catch {
    return FALLBACK_ORGANIZATION;
  }
});

/** Active branches for the switcher and directory. Empty list if the API is unreachable. */
export const getBranches = cache(async (): Promise<BranchSummary[]> => {
  try {
    const { client, fetch } = await publicApi({ revalidate: 300, tags: [CacheTags.branches] });
    return unwrap(await client.GET('/api/v1/branches', { fetch })).items;
  } catch {
    return [];
  }
});
