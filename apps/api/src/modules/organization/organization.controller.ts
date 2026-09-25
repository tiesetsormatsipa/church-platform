import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicOrganization } from '@church/shared';
import type { FastifyReply } from 'fastify';
import { ApiResult, Public } from '../../common/decorators/index.js';
import type { DatabaseClient } from '@church/database';
import { DATABASE } from '../../infrastructure/tokens.js';
import { MEDIA_URL_SELECT, MediaUrlService } from '../core/media-urls.service.js';
import { OrganizationService } from '../core/organization.service.js';

@ApiTags('organization')
@Public()
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly media: MediaUrlService,
    @Inject(DATABASE) private readonly db: DatabaseClient,
  ) {}

  @Get()
  @ApiResult(PublicOrganization)
  async get(@Res({ passthrough: true }) reply: FastifyReply) {
    const org = await this.organizations.current();
    const logo = org.logoMediaId
      ? await this.db.mediaAsset.findUnique({
          where: { id: org.logoMediaId },
          select: MEDIA_URL_SELECT,
        })
      : null;
    void reply.header('cache-control', 'public, max-age=300');
    const socialLinks = Object.fromEntries(
      Object.entries(org.parsedSettings.socialLinks).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    return {
      name: org.name,
      shortName: org.shortName,
      tagline: org.tagline,
      description: org.description,
      email: org.email,
      phone: org.phone,
      websiteUrl: org.websiteUrl,
      timezone: org.timezone,
      locale: org.locale,
      logo: this.media.image(logo),
      registrationOpen: org.parsedSettings.registrationOpen,
      socialLinks,
    };
  }
}
