import { SetMetadata } from '@nestjs/common';
export const GEO_SCOPE_KEY = 'geoScope';
export const GeoScope = (scope: string) => SetMetadata(GEO_SCOPE_KEY, scope);
