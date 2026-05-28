import { registerAs } from '@nestjs/config';
export default registerAs('app', () => ({
  nodeEnv:     process.env.NODE_ENV     || 'development',
  port:        parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  tenantId:    process.env.DEFAULT_TENANT_ID || 'main-church',
  logLevel:    process.env.LOG_LEVEL    || 'debug',
}));
