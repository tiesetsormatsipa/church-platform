import { registerAs } from '@nestjs/config';
export default registerAs('media', () => ({
  provider:  process.env.STORAGE_PROVIDER  || 'local',
  endpoint:  process.env.STORAGE_ENDPOINT || 'localhost',
  port:      process.env.STORAGE_PORT      || '9000',
  ssl:       process.env.STORAGE_SSL === 'true',
  bucket:    process.env.STORAGE_BUCKET    || 'church-platform',
  accessKey: process.env.STORAGE_ACCESS_KEY || 'church_admin',
  secretKey: process.env.STORAGE_SECRET_KEY || 'church_minio_secret',
  localRoot: process.env.STORAGE_LOCAL_ROOT || './storage/media',
  publicUrl: process.env.STORAGE_PUBLIC_URL || '/media',
  region:    process.env.STORAGE_REGION    || 'us-east-1',
}));
