import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CompleteUpload,
  MediaItem,
  MediaLibrary,
  MediaLibraryQuery,
  RequestUpload,
  UpdateMedia,
  UploadTicket,
  Uuid,
} from '@church/shared';
import type { z } from 'zod';
import {
  ApiResult,
  CurrentUser,
  Meta,
  RateLimit,
  RequireVerifiedEmail,
} from '../../common/decorators/index.js';
import type { Principal, RequestMeta } from '../../common/principal.js';
import { MediaService } from './media.service.js';

/**
 * Uploads happen in three steps so the API never carries the bytes: ask for a ticket, PUT
 * the file to the signed URL, then tell the API. The service decides who may upload what —
 * your own photograph needs no permission, anything else needs `media.upload`.
 */
@ApiTags('media')
@RequireVerifiedEmail()
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  @HttpCode(201)
  @RateLimit({ name: 'media.upload', limit: 60, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'Ask for a signed URL to upload one file to.' })
  @ApiResult(UploadTicket, { status: 201 })
  request(
    @CurrentUser() principal: Principal,
    @Body({ schema: RequestUpload }) body: z.output<typeof RequestUpload>,
    @Meta() meta: RequestMeta,
  ) {
    return this.media.requestUpload(principal, body, meta);
  }

  @Post(':id/complete')
  // Finishing an upload creates nothing: the row has existed since the ticket was issued.
  @HttpCode(200)
  @RateLimit({ name: 'media.complete', limit: 60, windowSeconds: 3600, by: 'user' })
  @ApiOperation({ summary: 'The upload finished; check it and start processing.' })
  @ApiResult(MediaItem)
  complete(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Body({ schema: CompleteUpload }) body: z.output<typeof CompleteUpload>,
    @Meta() meta: RequestMeta,
  ) {
    return this.media.complete(principal, id, body, meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One file, to poll while the worker is still on it.' })
  @ApiResult(MediaItem)
  get(@Param('id', { schema: Uuid }) id: string, @CurrentUser() principal: Principal) {
    return this.media.get(principal, id);
  }

  @Get()
  @ApiOperation({ summary: 'Files you may reuse. Everyone’s if you may manage the library.' })
  @ApiResult(MediaLibrary)
  library(
    @CurrentUser() principal: Principal,
    @Query({ schema: MediaLibraryQuery }) query: z.output<typeof MediaLibraryQuery>,
  ) {
    return this.media.library(principal, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change the description read aloud to people who cannot see it.' })
  @ApiResult(MediaItem)
  update(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Body({ schema: UpdateMedia }) body: z.output<typeof UpdateMedia>,
    @Meta() meta: RequestMeta,
  ) {
    return this.media.update(principal, id, body, meta);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Take a file out of the library.' })
  async remove(
    @Param('id', { schema: Uuid }) id: string,
    @CurrentUser() principal: Principal,
    @Meta() meta: RequestMeta,
  ) {
    await this.media.remove(principal, id, meta);
  }
}
