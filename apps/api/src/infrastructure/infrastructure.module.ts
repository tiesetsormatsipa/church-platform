import { Global, Inject, Logger, Module, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type DatabaseClient } from '@church/database';
import { JobProducer } from '@church/infrastructure/queue';
import { createRedis, type Redis } from '@church/infrastructure/redis';
import { PUBLIC_PREFIX, S3ObjectStorage } from '@church/infrastructure/storage';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { DATABASE, REDIS, STORAGE } from './tokens.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): DatabaseClient =>
        createPrismaClient({
          url: config.env.DATABASE_URL,
          poolMax: config.env.DATABASE_POOL_MAX,
          applicationName: 'church-api',
        }),
    },
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis =>
        createRedis({ url: config.env.REDIS_URL, name: 'church-api', lazyConnect: true }),
    },
    {
      provide: STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new S3ObjectStorage({
          ...(config.env.S3_ENDPOINT ? { endpoint: config.env.S3_ENDPOINT } : {}),
          ...(config.env.S3_PRESIGN_ENDPOINT ? { presignEndpoint: config.env.S3_PRESIGN_ENDPOINT } : {}),
          region: config.env.S3_REGION,
          bucket: config.env.S3_BUCKET,
          accessKeyId: config.env.S3_ACCESS_KEY_ID,
          secretAccessKey: config.env.S3_SECRET_ACCESS_KEY,
          forcePathStyle: config.env.S3_FORCE_PATH_STYLE,
          publicBaseUrl: config.env.MEDIA_PUBLIC_BASE_URL,
        }),
    },
    {
      provide: JobProducer,
      inject: [REDIS],
      useFactory: (redis: Redis) => new JobProducer(redis),
    },
  ],
  exports: [DATABASE, REDIS, STORAGE, JobProducer],
})
export class InfrastructureModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(InfrastructureModule.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(STORAGE) private readonly storage: S3ObjectStorage,
    private readonly jobs: JobProducer,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.OPENAPI_EXPORT === '1') return;
    await this.redis.connect().catch((error: unknown) => {
      // Readiness reports the outage; the process keeps running and ioredis reconnects.
      this.logger.error({ err: error }, 'Redis connection failed');
    });
    if (this.config.env.STORAGE_ENSURE_BUCKET) {
      await this.storage.ensureBucket({ publicPrefix: PUBLIC_PREFIX }).catch((error: unknown) => {
        this.logger.error({ err: error }, 'Could not ensure storage bucket');
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.jobs.close(), this.db.$disconnect()]);
    this.redis.disconnect();
    this.storage.destroy();
  }
}
