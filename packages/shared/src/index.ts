// packages/shared/src/index.ts
// Shared types and constants used by both @church/web and @church/api

// ---- Status enums ----
export const GEO_STATUS = {
  ACTIVE:            'ACTIVE',
  COMING_SOON:       'COMING_SOON',
  UNDER_DEVELOPMENT: 'UNDER_DEVELOPMENT',
  PLANNED:           'PLANNED',
  RESTRICTED:        'RESTRICTED',
  INACTIVE:          'INACTIVE',
} as const;
export type GeoStatus = typeof GEO_STATUS[keyof typeof GEO_STATUS];

export const CONTENT_STATUS = {
  DRAFT:          'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED:       'APPROVED',
  PUBLISHED:      'PUBLISHED',
  REJECTED:       'REJECTED',
  ARCHIVED:       'ARCHIVED',
} as const;
export type ContentStatus = typeof CONTENT_STATUS[keyof typeof CONTENT_STATUS];

export const VERIFICATION_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING:    'PENDING',
  VERIFIED:   'VERIFIED',
  REJECTED:   'REJECTED',
  FLAGGED:    'FLAGGED',
} as const;
export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

// ---- Role slugs ----
export const ROLES = {
  GLOBAL_SUPER_ADMIN:   'global-super-admin',
  SUPER_ADMIN:          'super-admin',
  PLATFORM_ADMIN:       'platform-admin',
  CONTINENTAL_ADMIN:    'continental-admin',
  REGIONAL_ADMIN:       'regional-admin',
  COUNTRY_ADMIN:        'country-admin',
  PROVINCE_ADMIN:       'province-admin',
  BRANCH_ADMIN:         'branch-admin',
  BRANCH_MODERATOR:     'branch-moderator',
  MEMBERSHIP_VERIFIER:  'membership-verifier',
  OVERSEER:             'overseer',
  MINISTER:             'minister',
  DEACON:               'deacon',
  AUXILIARY_LEADER:     'auxiliary-leader',
  AUXILIARY_MEMBER:     'auxiliary-member',
  MARKETPLACE_SELLER:   'marketplace-seller',
  JOB_POSTER:           'job-poster',
  SONG_UPLOADER:        'song-uploader',
  VERIFIED_MEMBER:      'verified-member',
  UNVERIFIED_MEMBER:    'unverified-member',
  PUBLIC_VISITOR:       'public-visitor',
} as const;
export type RoleSlug = typeof ROLES[keyof typeof ROLES];

// ---- Feature modules ----
export const FEATURE_MODULES = {
  HOME:          'home',
  PROFILE:       'profile',
  REGIONS:       'regions',
  BRANCHES:      'branches',
  MESSAGING:     'messaging',
  MARKETPLACE:   'marketplace',
  JOBS:          'jobs',
  SERMONS:       'sermons',
  PRAISE_SONGS:  'praise_songs',
  ADMIN:         'admin',
  ANNOUNCEMENTS: 'announcements',
} as const;
export type FeatureModule = typeof FEATURE_MODULES[keyof typeof FEATURE_MODULES];

export const ALWAYS_ON_MODULES: FeatureModule[] = [
  FEATURE_MODULES.HOME,
  FEATURE_MODULES.PROFILE,
  FEATURE_MODULES.REGIONS,
];

// ---- Map color scheme ----
export const GEO_STATUS_COLORS: Record<GeoStatus, string> = {
  ACTIVE:            '#D4AF37', // gold
  COMING_SOON:       '#3B82F6', // blue
  UNDER_DEVELOPMENT: '#60A5FA', // light blue
  PLANNED:           '#9CA3AF', // gray
  RESTRICTED:        '#6B7280', // dark gray
  INACTIVE:          '#374151', // charcoal
};

// ---- API response types ----
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  feature?: string;
}

// ---- Branch types ----
export type BranchType = 'MAIN' | 'SUB' | 'SATELLITE' | 'ONLINE';

export interface GeoHierarchy {
  continentId?: string;
  regionId?:    string;
  countryId?:   string;
  provinceId?:  string;
  cityId?:      string;
  branchId?:    string;
}

// ---- Order types ----
export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  | 'REFUNDED' | 'DISPUTED';

export type PaymentStatus =
  | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL';

// ---- Job types ----
export type JobType =
  | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
  | 'INTERNSHIP' | 'VOLUNTEER' | 'FREELANCE';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME:   'Full Time',
  PART_TIME:   'Part Time',
  CONTRACT:    'Contract',
  INTERNSHIP:  'Internship',
  VOLUNTEER:   'Volunteer',
  FREELANCE:   'Freelance',
};

// ---- Notification types ----
export type NotificationType =
  | 'ANNOUNCEMENT' | 'MESSAGE' | 'ORDER_UPDATE'
  | 'JOB_UPDATE' | 'VERIFICATION_UPDATE' | 'MODERATION_ACTION'
  | 'FEATURE_TOGGLE' | 'BRANCH_UPDATE' | 'SYSTEM';

// ---- Rollout rule types ----
export type RolloutRuleType = 'ALL' | 'ROLE' | 'COUNTRY' | 'VERIFICATION_STATUS' | 'PERCENTAGE';

// ---- Media types ----
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav'];
export const MAX_CHAT_PDF_SIZE   = 500 * 1024;       // 500 KB
export const MAX_IMAGE_SIZE      = 5 * 1024 * 1024;  // 5 MB
export const MAX_AUDIO_SIZE      = 150 * 1024 * 1024; // 150 MB
