import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class StorageAdapter {
  private readonly logger = new Logger(StorageAdapter.name);
  private localRoot: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.localRoot = path.resolve(this.config.get<string>('media.localRoot', './storage/media'));
    this.publicUrl = this.config.get<string>('media.publicUrl', '/media').replace(/\/$/, '');
  }

  private resolveKey(key: string): string {
    const target = path.resolve(this.localRoot, key);
    if (!target.startsWith(this.localRoot)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async upload(key: string, buffer: Buffer, mimeType: string, isPublic: boolean): Promise<string> {
    void isPublic;
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    this.logger.debug(`Stored ${mimeType} media at ${target}`);
    return `${this.publicUrl}/${key.replace(/\\/g, '/')}`;
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    void expiresIn;
    return `${this.publicUrl}/${key.replace(/\\/g, '/')}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}
