import { Inject, Injectable } from '@nestjs/common';
import type { AuthTokenPurpose, DatabaseClient, DbExecutor } from '@church/database';
import { randomToken, sha256Hex } from '@church/infrastructure/tokens';
import { DATABASE } from '../../infrastructure/tokens.js';

export const TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

/** Single-use e-mailed tokens. Issuing a new token invalidates older ones of the same purpose. */
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
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
      },
    });
    return { token, expiresInMinutes: Math.round(TOKEN_TTL_MS[purpose] / 60_000) };
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
}
