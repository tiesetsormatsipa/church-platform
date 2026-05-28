import { registerAs } from '@nestjs/config';
export default registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'smtp',
  host:     process.env.SMTP_HOST      || 'localhost',
  port:     process.env.SMTP_PORT      || '1025',
  secure:   process.env.SMTP_SECURE === 'true',
  user:     process.env.SMTP_USER      || '',
  pass:     process.env.SMTP_PASS      || '',
  from:     process.env.EMAIL_FROM     || 'noreply@church.org',
  fromName: process.env.EMAIL_FROM_NAME || 'Church Platform',
}));
