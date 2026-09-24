import { Global, Module } from '@nestjs/common';
import { ContentQueryService } from './content-query.service.js';
import { ContentMapper } from './content.mapper.js';
import { PublicContentController } from './public-content.controller.js';

@Global()
@Module({
  controllers: [PublicContentController],
  providers: [ContentQueryService, ContentMapper],
  exports: [ContentQueryService, ContentMapper],
})
export class ContentModule {}
