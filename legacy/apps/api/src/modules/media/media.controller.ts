import { Controller, Post, Get, Delete, Param, Req, UploadedFile, UseInterceptors, Query, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('media')
@ApiBearerAuth()
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload/:context')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('context') context: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('public') isPublicStr?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.mediaService.upload(file, req.user.id, context, isPublicStr === 'true', req.headers['x-tenant-id']);
  }

  @Get(':id/url')
  async getSignedUrl(@Param('id') id: string, @Req() req: any, @Query('expiresIn') expiresIn?: number) {
    const url = await this.mediaService.getSignedUrl(id, req.user.id, expiresIn || 3600);
    return { url };
  }

  @Delete(':id')
  @Roles('super-admin', 'platform-admin')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.mediaService.delete(id, req.user.id);
    return { success: true };
  }
}
