import { registerAs } from '@nestjs/config';
export default registerAs('auth', () => ({
  jwtSecret:           process.env.JWT_SECRET          || 'dev-jwt-secret-change-me',
  jwtRefreshSecret:    process.env.JWT_REFRESH_SECRET  || 'dev-refresh-secret-change-me',
  jwtExpiresIn:        process.env.JWT_EXPIRES_IN      || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  googleClientId:      process.env.GOOGLE_CLIENT_ID    || '',
  googleClientSecret:  process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl:   process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
}));
