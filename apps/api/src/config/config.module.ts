import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, buildConfig } from './env.js';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => buildConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
