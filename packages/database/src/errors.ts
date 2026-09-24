import { Prisma } from './generated/prisma/client.js';

function knownCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

/** Unique constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return knownCode(error) === 'P2002';
}

/** Foreign key constraint violation (P2003). */
export function isForeignKeyViolation(error: unknown): boolean {
  return knownCode(error) === 'P2003';
}

/** Record required by the operation was not found (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return knownCode(error) === 'P2025';
}
