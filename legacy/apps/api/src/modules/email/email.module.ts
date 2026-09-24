import { Module, Global } from '@nestjs/common';
import { EmailAdapter } from './email.adapter';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [EmailAdapter],
  exports: [EmailAdapter],
})
export class EmailModule {}
