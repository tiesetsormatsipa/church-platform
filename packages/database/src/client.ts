import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  /** PostgreSQL connection string. */
  url: string;
  /** Maximum pooled connections for this process (node-postgres pool). */
  poolMax?: number;
  /** Application name reported to PostgreSQL (visible in pg_stat_activity). */
  applicationName?: string;
  log?: Prisma.LogLevel[];
}

/** Create a Prisma client backed by a node-postgres connection pool. */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.url,
    max: options.poolMax ?? 10,
    application_name: options.applicationName ?? 'church-platform',
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter, log: options.log ?? ['warn', 'error'] });
}

export type DatabaseClient = PrismaClient;

/** A client usable inside or outside an interactive transaction. */
export type DbExecutor = PrismaClient | Prisma.TransactionClient;
