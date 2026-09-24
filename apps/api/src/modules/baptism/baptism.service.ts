import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import type { AcceptedResponse, BaptismRequestCreate } from '@church/shared';
import type { z } from 'zod';
import { Errors } from '../../common/http/errors.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { DATABASE } from '../../infrastructure/tokens.js';
import { BranchQueryService } from '../branches/branch-query.service.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';

@Injectable()
export class BaptismService {
  private readonly logger = new Logger(BaptismService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly organizations: OrganizationService,
    private readonly branches: BranchQueryService,
    private readonly audit: AuditService,
    private readonly jobs: JobProducer,
  ) {}

  /** A visitor or member asks to be baptised; the branch's administrators follow up. */
  async submit(
    input: z.output<typeof BaptismRequestCreate>,
    principal: Principal | null,
    meta: RequestMeta,
  ): Promise<AcceptedResponse> {
    const organization = await this.organizations.current();
    if (!organization.parsedSettings.baptismRequestsEnabled) {
      throw Errors.unavailable('Baptism enquiries are not being accepted online at the moment.', 'BAPTISM_REQUESTS_CLOSED');
    }
    const branch = await this.branches.resolveRef(organization.id, input.branch);
    const request = await this.db.baptismRequest.create({
      data: {
        organizationId: organization.id,
        branchId: branch.id,
        userId: principal?.userId ?? null,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        preferredDate: input.preferredDate ? new Date(`${input.preferredDate}T00:00:00Z`) : null,
        message: input.message ?? null,
        consentAt: new Date(),
      },
      select: { id: true },
    });
    await this.audit.record({
      organizationId: organization.id,
      actorId: principal?.userId ?? null,
      action: 'baptism_request.create',
      entityType: 'BaptismRequest',
      entityId: request.id,
      branchId: branch.id,
      meta,
    });
    await this.jobs
      .enqueue('baptismRequestReceived', { baptismRequestId: request.id, requestId: meta.requestId })
      .catch((error: unknown) => this.logger.error({ err: error }, 'Could not enqueue baptism notification'));
    return {
      status: 'accepted',
      message: `Thank you. Someone from the ${branch.name} branch will contact you soon.`,
    };
  }
}
