import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private auth: AuthService) {
    super({
      clientID: config.get<string>('auth.googleClientId') || 'PLACEHOLDER',
      clientSecret: config.get<string>('auth.googleClientSecret') || 'PLACEHOLDER',
      callbackURL: config.get<string>('auth.googleCallbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: any) {
    return this.auth.validateGoogleUser(profile);
  }
}
