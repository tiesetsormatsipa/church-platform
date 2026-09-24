import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FeaturesService } from './features.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('features')
@Controller({ path: 'features', version: '1' })
export class FeaturesController {
  constructor(private featuresService: FeaturesService) {}

  @Public()
  @Get('navigation')
  getNavigationConfig(@Req() req: any) {
    return this.featuresService.getNavigationConfig(req?.headers?.['x-tenant-id']);
  }

  @Get()
  getAllFlags(@Req() req: any) {
    return this.featuresService.getAllFlags(req?.headers?.['x-tenant-id']);
  }
}
