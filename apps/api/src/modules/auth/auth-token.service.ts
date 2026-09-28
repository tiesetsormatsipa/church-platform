import { Inject, Injectable } from '@nestjs/common';
import type { AuthTokenPurpose, DatabaseClient, DbExecutor } from '@church/database';
import { randomToken, sha256Hex } from '@church/infrastructure/tokens';
import { randomInt } from 'node:crypto';
import { DATABASE } from '../../infrastructure/tokens.js';

export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  // The code in the same message is what most people will use, so this is the patience of
  // someone who has walked to another room to fetch their phone, not of a link in an archive.
  EMAIL_VERIFICATION: 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

/** Digits in the confirmation code. Six is what people expect and can hold in their head. */
export const CODE_LENGTH = 6;

/** Wrong guesses allowed before the code is dead and a new one must be asked for. */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * A six-digit code, drawn from a source fit for secrets.
 *
 * `randomInt` rather than `Math.random`: a predictable confirmation code is the same as no
 * confirmation at all.
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/** Digits only, so "123 456" and "123-456" are read as the same code somebody typed. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Single-use e-mailed tokens. Issuing a new one invalidates older tokens of the same purpose.
 *
 * A verification carries two ways in: a long random token behind a link, and a short code in
 * the body of the same message. They confirm the same thing and either consumes the row. The
 * code exists because the link only works where the e-mail is read, and people read their
 * e-mail on a phone while signing up on something else.
 */
@Injectable()
export class AuthTokenService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async issue(
    userId: string,
    purpose: AuthTokenPurpose,
    sentTo: string,
    executor: DbExecutor = this.db,
  ) {
    const token = randomToken(32);
    const code = generateCode();
    const now = new Date();
    await executor.authToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await executor.authToken.create({
      data: {
        userId,
        purpose,
        sentTo,
        tokenHash: sha256Hex(token),
        codeHash: sha256Hex(code),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
      },
    });
    return { token, code, expiresInMinutes: Math.round(TOKEN_TTL_MS[purpose] / 60_000) };
  }

  /** Atomically consume a token; returns the user id or null when invalid/expired/used. */
  async consume(
    token: string,
    purpose: AuthTokenPurpose,
    executor: DbExecutor = this.db,
  ): Promise<string | null> {
    const now = new Date();
    const tokenHash = sha256Hex(token);
    const result = await executor.authToken.updateMany({
      where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (result.count !== 1) return null;
    const row = await executor.authToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  /**
   * Consume the code that was sent to one address.
   *
   * Scoped to the address rather than searched for globally: six digits are not unique, and
   * a code is only meaningful together with the account it was sent to. Every wrong guess is
   * counted, and the row dies after a handful, so the six digits cannot simply be walked
   * through.
   */
  async consumeCode(
    sentTo: string,
    code: string,
    purpose: AuthTokenPurpose,
    executor: DbExecutor = this.db,
  ): Promise<{ userId: string } | { error: 'invalid' | 'expired' | 'too_many' }> {
    const now = new Date();
    const row = await executor.authToken.findFirst({
      where: { sentTo, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, codeHash: true, attempts: true, expiresAt: true },
    });

    if (!row || !row.codeHash) return { error: 'invalid' };
    if (row.expiresAt <= now) return { error: 'expired' };
    if (row.attempts >= MAX_CODE_ATTEMPTS) return { error: 'too_many' };

    if (row.codeHash !== sha256Hex(normalizeCode(code))) {
      await executor.authToken.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      return { error: 'invalid' };
    }

    // Consume conditionally, so two tabs racing cannot both win.
    const claimed = await executor.authToken.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) return { error: 'invalid' };
    return { userId: row.userId };
  }
}
