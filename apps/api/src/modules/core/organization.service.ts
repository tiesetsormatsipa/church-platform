import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient, Organization } from '@church/database';
import { parseOrganizationSettings, type OrganizationSettings } from '@church/shared';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { Errors } from '../../common/http/errors.js';

export interface CurrentOrganization extends Organization {
  parsedSettings: OrganizationSettings;
}

const CACHE_TTL_MS = 30_000;

/**
 * Resolves the organisation this deployment serves (from configuration, never from the
 * request). Cached briefly; call `invalidate()` after updates.
 */
@Injectable()
export class OrganizationService {
  private cached: { value: CurrentOrganization; expiresAt: number } | null = null;

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async current(): Promise<CurrentOrganization> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    const organization = await this.db.organization.findUnique({
      where: { slug: this.config.env.ORGANIZATION_SLUG },
    });
    if (!organization) {
      throw Errors.unavailable('The site has not been set up yet.', 'ORGANIZATION_NOT_CONFIGURED');
    }
    const value = {
      ...organization,
      parsedSettings: parseOrganizationSettings(organization.settings),
    };
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  async currentId(): Promise<string> {
    return (await this.current()).id;
  }

  invalidate(): void {
    this.cached = null;
  }
}
