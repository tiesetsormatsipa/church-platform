/**
 * Signing in with a Google account.
 *
 * Authorisation code flow with PKCE. The only state kept between the two requests is a short
 * cookie holding the CSRF state, the PKCE verifier, the nonce and where to return to; there
 * is nothing to clean up if someone abandons the flow half way.
 *
 * The ID token's signature is not checked against Google's keys, and does not need to be:
 * it is fetched by this server directly from Google's token endpoint over TLS, which
 * OpenID Connect Core §3.1.3.7 accepts in place of signature validation. What is checked is
 * everything that identifies the token as ours — issuer, audience, expiry and the nonce we
 * sent — so a token minted for another application cannot be replayed here.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseClient } from '@church/database';
import type { Redis } from '@church/infrastructure/redis';
import { normalizeEmail } from '@church/shared';
import { Errors } from '../../common/http/errors.js';
import type { RequestMeta } from '../../common/principal.js';
import { APP_CONFIG, type AppConfig } from '../../config/env.js';
import { DATABASE, REDIS } from '../../infrastructure/tokens.js';
import { AuditService } from '../core/audit.service.js';
import { OrganizationService } from '../core/organization.service.js';

const AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** Long enough to sign in, short enough that an abandoned attempt expires unnoticed. */
export const FLOW_TTL_SECONDS = 10 * 60;

export interface GoogleFlow {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

export interface GoogleProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/** Decode a JWT payload without verifying it; the caller checks every claim that matters. */
export function decodeIdToken(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  if (!part) throw Errors.badRequest('google_token', 'Google sent something unreadable.');
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw Errors.badRequest('google_token', 'Google sent something unreadable.');
  }
}

/**
 * Everything about the token that has to be true for it to be ours. Exported so the rules
 * can be tested without a network.
 */
export function readProfile(
  claims: Record<string, unknown>,
  expected: { clientId: string; nonce: string },
  now = new Date(),
): GoogleProfile {
  const reject = (why: string) => Errors.unauthenticated(why);

  const issuer = typeof claims.iss === 'string' ? claims.iss : '';
  if (!ISSUERS.has(issuer)) throw reject('That sign-in did not come from Google.');

  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(expected.clientId)) {
    throw reject('That sign-in was meant for a different application.');
  }

  const expiry = typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
  if (expiry <= now.getTime()) throw reject('That sign-in has expired. Please try again.');

  if (claims.nonce !== expected.nonce) {
    throw reject('That sign-in could not be matched to this browser. Please try again.');
  }

  const subject = typeof claims.sub === 'string' ? claims.sub : '';
  const email = typeof claims.email === 'string' ? claims.email : '';
  if (!subject || !email) throw reject('Google did not share an e-mail address.');

  // Google says whether it has checked the address. An unchecked one must not be allowed to
  // claim an existing account that uses the same address.
  if (claims.email_verified !== true) {
    throw reject('Google has not confirmed that e-mail address.');
  }

  const given = typeof claims.given_name === 'string' ? claims.given_name : '';
  const family = typeof claims.family_name === 'string' ? claims.family_name : '';
  const full = typeof claims.name === 'string' ? claims.name : '';
  const parts = full.split(/\s+/).filter(Boolean);

  return {
    subject,
    email: normalizeEmail(email),
    emailVerified: true,
    firstName: given || parts[0] || 'Friend',
    lastName: family || (parts.length > 1 ? parts.slice(1).join(' ') : ''),
  };
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly organizations: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  get enabled(): boolean {
    return this.config.google !== null;
  }

  private get google() {
    if (!this.config.google) {
      throw Errors.unavailable('Signing in with Google is not set up for this site.');
    }
    return this.config.google;
  }

  /**
   * Remember a flow server-side and return the ticket that names it.
   *
   * The browser only carries the ticket, so nothing an attacker can write into a cookie
   * becomes a flow the server will honour: an unknown ticket simply has no flow.
   */
  private async remember(flow: GoogleFlow): Promise<string> {
    const ticket = base64url(randomBytes(18));
    await this.redis.set(`oauth:google:${ticket}`, JSON.stringify(flow), 'EX', FLOW_TTL_SECONDS);
    return ticket;
  }

  /** Read a flow back exactly once; a second use of the same ticket finds nothing. */
  async recall(ticket: string): Promise<GoogleFlow | null> {
    const key = `oauth:google:${ticket}`;
    const raw = await this.redis.get(key);
    await this.redis.del(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GoogleFlow;
    } catch {
      return null;
    }
  }

  /** The URL to send the browser to, plus the ticket naming the flow it belongs to. */
  private begin(next: string): { url: string; flow: GoogleFlow } {
    const { clientId, redirectUri } = this.google;
    const flow: GoogleFlow = {
      state: base64url(randomBytes(24)),
      verifier: base64url(randomBytes(48)),
      nonce: base64url(randomBytes(16)),
      next,
    };
    const challenge = base64url(createHash('sha256').update(flow.verifier).digest());
    const url = new URL(AUTH_URI);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', flow.state);
    url.searchParams.set('nonce', flow.nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    // Ask every time rather than silently reusing whichever account the browser is signed
    // in to: shared phones are the norm, not the exception.
    url.searchParams.set('prompt', 'select_account');
    return { url: url.toString(), flow };
  }

  /** Begin a sign-in: the URL to send the browser to, and the ticket to set as a cookie. */
  async start(next: string): Promise<{ url: string; ticket: string }> {
    const { url, flow } = this.begin(next);
    return { url, ticket: await this.remember(flow) };
  }

  /** Trade the code for an ID token and read who it says this is. */
  async exchange(code: string, flow: GoogleFlow): Promise<GoogleProfile> {
    const { clientId, clientSecret, redirectUri } = this.google;
    const response = await fetch(TOKEN_URI, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
    });

    if (!response.ok) {
      // The body can carry the client secret back in an error echo, so none of it is logged.
      this.logger.warn({ status: response.status }, 'Google rejected the code exchange');
      throw Errors.unauthenticated('Google could not complete that sign-in. Please try again.');
    }

    const body = (await response.json()) as { id_token?: unknown };
    if (typeof body.id_token !== 'string') {
      throw Errors.unauthenticated('Google did not identify the account.');
    }
    return readProfile(decodeIdToken(body.id_token), {
      clientId,
      nonce: flow.nonce,
    });
  }

  /**
   * The account behind a Google profile: the one already linked, the one with that address,
   * or a new one.
   */
  async resolveUser(profile: GoogleProfile, meta: RequestMeta): Promise<{ userId: string }> {
    const existing = await this.db.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: 'GOOGLE', providerUserId: profile.subject } },
      select: { userId: true, user: { select: { status: true, deletedAt: true } } },
    });
    if (existing) {
      if (existing.user.deletedAt || existing.user.status !== 'ACTIVE') {
        throw Errors.forbidden('That account is not available. Please contact the church.');
      }
      await this.db.authIdentity.updateMany({
        where: { provider: 'GOOGLE', providerUserId: profile.subject },
        data: { lastUsedAt: new Date(), email: profile.email },
      });
      return { userId: existing.userId };
    }

    const byEmail = await this.db.user.findUnique({
      where: { email: profile.email },
      select: { id: true, status: true, deletedAt: true },
    });

    if (byEmail) {
      if (byEmail.deletedAt || byEmail.status !== 'ACTIVE') {
        throw Errors.forbidden('That account is not available. Please contact the church.');
      }
      // Safe to join the two: Google has confirmed the address, which is the same proof the
      // ordinary sign-up asks for.
      await this.db.authIdentity.create({
        data: {
          userId: byEmail.id,
          provider: 'GOOGLE',
          providerUserId: profile.subject,
          email: profile.email,
          lastUsedAt: new Date(),
        },
      });
      await this.db.user.update({
        where: { id: byEmail.id },
        data: { emailVerifiedAt: { set: new Date() } },
      });
      await this.audit.record({
        organizationId: await this.organizations.currentId(),
        actorId: byEmail.id,
        action: 'auth.google_linked',
        entityType: 'User',
        entityId: byEmail.id,
        meta,
      });
      return { userId: byEmail.id };
    }

    const created = await this.db.user.create({
      data: {
        email: profile.email,
        // Google vouched for the address, so there is nothing to confirm by post.
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
        // No password: this account signs in with Google until it sets one.
        profile: {
          create: {
            firstName: profile.firstName,
            lastName: profile.lastName || profile.firstName,
            privacyConsentAt: new Date(),
            termsAcceptedAt: new Date(),
          },
        },
        identities: {
          create: {
            provider: 'GOOGLE',
            providerUserId: profile.subject,
            email: profile.email,
            lastUsedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    await this.audit.record({
      organizationId: await this.organizations.currentId(),
      actorId: created.id,
      action: 'auth.google_registered',
      entityType: 'User',
      entityId: created.id,
      meta,
    });
    return { userId: created.id };
  }
}
