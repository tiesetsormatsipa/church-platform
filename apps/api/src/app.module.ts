import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { StandardSchemaSerializerInterceptor } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ProblemDetailsFilter } from './common/http/problem-details.filter.js';
import { ConfigModule } from './config/config.module.js';
import { APP_CONFIG, type AppConfig } from './config/env.js';
import { httpLoggerOptions } from './config/logging.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { PermissionGuard } from './modules/access/permission.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BaptismModule } from './modules/baptism/baptism.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { CsrfGuard } from './modules/auth/csrf.guard.js';
import { RateLimitGuard } from './modules/auth/rate-limit.guard.js';
import { SessionAuthGuard } from './modules/auth/session-auth.guard.js';
import { CoreModule } from './modules/core/core.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => httpLoggerOptions(config),
    }),
    InfrastructureModule,
    CoreModule,
    AccessModule,
    AuthModule,
    HealthModule,
    OrganizationModule,
    BranchesModule,
    ContentModule,
    BaptismModule,
  ],
  providers: [
    // Global guards run in this order: identify the caller, throttle, verify CSRF, authorise.
    { provide: APP_GUARD, useExisting: SessionAuthGuard },
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    {
      provide: APP_INTERCEPTOR,
      inject: [Reflector],
      useFactory: (reflector: Reflector) => new StandardSchemaSerializerInterceptor(reflector),
    },
  ],
})
export class AppModule {}
