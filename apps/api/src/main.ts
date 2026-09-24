import { loadDotEnv } from '@church/infrastructure/env';

loadDotEnv();
const { createApp } = await import('./bootstrap.js');
const { APP_CONFIG } = await import('./config/env.js');

const app = await createApp();
const config = app.get<import('./config/env.js').AppConfig>(APP_CONFIG);
await app.listen({ port: config.env.PORT, host: config.env.HOST });
