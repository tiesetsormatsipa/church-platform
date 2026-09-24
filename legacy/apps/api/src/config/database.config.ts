import { registerAs } from '@nestjs/config';
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'postgresql://church_user:church_secret@localhost:5432/church_platform',
}));
