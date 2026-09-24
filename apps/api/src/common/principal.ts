import type { Grant } from '@church/shared';

/** The authenticated user behind a request, resolved from the session cookie. */
export interface Principal {
  userId: string;
  sessionId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarMediaId: string | null;
  homeBranchId: string | null;
  grants: Grant[];
}

/** Request facts recorded in audit logs and passed to background jobs. */
export interface RequestMeta {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}
