import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditService } from '../admin/audit.service';
import { EmailModule } from '../email/email.module';
import { OrderProcessor } from '../queue/order.processor';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    BullModule.registerQueue({ name: 'order-processing' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [MarketplaceController, OrdersController],
  providers: [MarketplaceService, OrdersService, AuditService, OrderProcessor],
  exports: [MarketplaceService, OrdersService],
})
export class MarketplaceModule {}
