import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';

import { DatabaseModule }      from './database/database.module';
import { AuthModule }          from './modules/auth/auth.module';
import { UsersModule }         from './modules/users/users.module';
import { BranchesModule }      from './modules/branches/branches.module';
import { GeoModule }           from './modules/geo/geo.module';
import { FeaturesModule }      from './modules/features/features.module';
import { MessagingModule }     from './modules/messaging/messaging.module';
import { MarketplaceModule }   from './modules/marketplace/marketplace.module';
import { JobsModule }          from './modules/jobs/jobs.module';
import { SermonsModule }       from './modules/sermons/sermons.module';
import { SongsModule }         from './modules/songs/songs.module';
import { AdminModule }         from './modules/admin/admin.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { MediaModule }         from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule }         from './modules/email/email.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { RolesGuard }   from './common/guards/roles.guard';

import appConfig      from './config/app.config';
import authConfig     from './config/auth.config';
import databaseConfig from './config/database.config';
import mediaConfig    from './config/media.config';
import emailConfig    from './config/email.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, mediaConfig, emailConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 10  },
      { name: 'medium', ttl: 10000, limit: 50  },
      { name: 'long',   ttl: 60000, limit: 200 },
    ]),
    BullModule.forRoot({
      redis: {
        host:     process.env.REDIS_HOST     || 'localhost',
        port:     parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    DatabaseModule,
    EmailModule,
    AuthModule,
    UsersModule,
    GeoModule,
    FeaturesModule,
    BranchesModule,
    AnnouncementsModule,
    SermonsModule,
    SongsModule,
    MessagingModule,
    MarketplaceModule,
    JobsModule,
    MediaModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard  },
    { provide: APP_GUARD, useClass: RolesGuard    },
    { provide: APP_GUARD, useClass: FeatureGuard  },
  ],
})
export class AppModule {}
