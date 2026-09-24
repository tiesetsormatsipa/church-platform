import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── TENANT ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'main-church' },
    update: {},
    create: {
      name: 'Church Platform',
      slug: 'main-church',
      isActive: true,
      settings: {
        create: {
          requireVerification: true,
          defaultLocale: 'en-ZA',
          defaultCurrency: 'ZAR',
          defaultTimezone: 'Africa/Johannesburg',
        },
      },
      brandSettings: {
        create: {
          primaryColor: '#D4AF37',
          secondaryColor: '#1B2B4B',
          accentColor: '#8B0000',
          fontHeading: 'Playfair Display',
          fontBody: 'Source Serif 4',
        },
      },
    },
  });
  console.log('✓ Tenant created:', tenant.id);

  // ── GEO HIERARCHY ───────────────────────────────────────────────────────
  const africa = await prisma.continent.upsert({
    where: { code: 'AF' },
    update: {},
    create: { name: 'Africa', code: 'AF', status: 'ACTIVE' },
  });
  const europe = await prisma.continent.upsert({
    where: { code: 'EU' },
    update: {},
    create: { name: 'Europe', code: 'EU', status: 'COMING_SOON' },
  });
  const asia = await prisma.continent.upsert({
    where: { code: 'AS' },
    update: {},
    create: { name: 'Asia', code: 'AS', status: 'PLANNED' },
  });

  const sarRegion = await prisma.region.upsert({
    where: { code: 'SAR' },
    update: {},
    create: { name: 'Southern African Region', code: 'SAR', continentId: africa.id, status: 'ACTIVE' },
  });
  const eurRegion = await prisma.region.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { name: 'European Region', code: 'EUR', continentId: europe.id, status: 'COMING_SOON' },
  });

  const za = await prisma.country.upsert({
    where: { code: 'ZA' },
    update: {},
    create: { name: 'South Africa', code: 'ZA', continentId: africa.id, regionId: sarRegion.id, status: 'ACTIVE', currency: 'ZAR', locale: 'en-ZA', timezone: 'Africa/Johannesburg', phoneCode: '+27' },
  });
  await prisma.country.upsert({ where: { code: 'NA' }, update: {}, create: { name: 'Namibia', code: 'NA', continentId: africa.id, regionId: sarRegion.id, status: 'COMING_SOON', currency: 'NAD', locale: 'en-NA', timezone: 'Africa/Windhoek' } });
  await prisma.country.upsert({ where: { code: 'BW' }, update: {}, create: { name: 'Botswana', code: 'BW', continentId: africa.id, regionId: sarRegion.id, status: 'COMING_SOON', currency: 'BWP', locale: 'en-BW', timezone: 'Africa/Gaborone' } });
  await prisma.country.upsert({ where: { code: 'ZW' }, update: {}, create: { name: 'Zimbabwe', code: 'ZW', continentId: africa.id, regionId: sarRegion.id, status: 'UNDER_DEVELOPMENT', currency: 'ZWL', locale: 'en-ZW', timezone: 'Africa/Harare' } });
  await prisma.country.upsert({ where: { code: 'LS' }, update: {}, create: { name: 'Lesotho', code: 'LS', continentId: africa.id, regionId: sarRegion.id, status: 'PLANNED' } });
  await prisma.country.upsert({ where: { code: 'MZ' }, update: {}, create: { name: 'Mozambique', code: 'MZ', continentId: africa.id, regionId: sarRegion.id, status: 'PLANNED' } });
  await prisma.country.upsert({ where: { code: 'SZ' }, update: {}, create: { name: 'Eswatini', code: 'SZ', continentId: africa.id, regionId: sarRegion.id, status: 'PLANNED' } });
  await prisma.country.upsert({ where: { code: 'GB' }, update: {}, create: { name: 'United Kingdom', code: 'GB', continentId: europe.id, regionId: eurRegion.id, status: 'COMING_SOON', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London' } });
  console.log('✓ Geo hierarchy seeded');

  // SA Provinces
  const provinces = await Promise.all(
    ['Gauteng', 'Western Cape', 'Eastern Cape', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape'].map((name) =>
      prisma.province.upsert({ where: { name_countryId: { name, countryId: za.id } }, update: {}, create: { name, countryId: za.id } })
    )
  );
  const [gauteng, westernCape] = provinces;

  const joburg   = await prisma.city.create({ data: { name: 'Johannesburg', provinceId: gauteng.id, countryId: za.id } }).catch(() => prisma.city.findFirst({ where: { name: 'Johannesburg' } }));
  const capeTown = await prisma.city.create({ data: { name: 'Cape Town',    provinceId: westernCape.id, countryId: za.id } }).catch(() => prisma.city.findFirst({ where: { name: 'Cape Town' } }));

  // ── ROLES ────────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: 'Global Super Admin',  slug: 'global-super-admin',  scope: 'GLOBAL',      isSystem: true  },
    { name: 'Super Admin',         slug: 'super-admin',          scope: 'GLOBAL',      isSystem: true  },
    { name: 'Platform Admin',      slug: 'platform-admin',       scope: 'GLOBAL',      isSystem: true  },
    { name: 'Continental Admin',   slug: 'continental-admin',    scope: 'CONTINENTAL', isSystem: true  },
    { name: 'Regional Admin',      slug: 'regional-admin',       scope: 'REGIONAL',    isSystem: true  },
    { name: 'Country Admin',       slug: 'country-admin',        scope: 'COUNTRY',     isSystem: true  },
    { name: 'Province Admin',      slug: 'province-admin',       scope: 'PROVINCE',    isSystem: true  },
    { name: 'Branch Admin',        slug: 'branch-admin',         scope: 'BRANCH',      isSystem: true  },
    { name: 'Branch Moderator',    slug: 'branch-moderator',     scope: 'BRANCH',      isSystem: true  },
    { name: 'Membership Verifier', slug: 'membership-verifier',  scope: 'BRANCH',      isSystem: true  },
    { name: 'Overseer',            slug: 'overseer',             scope: 'BRANCH',      isSystem: false },
    { name: 'Minister',            slug: 'minister',             scope: 'BRANCH',      isSystem: false },
    { name: 'Deacon',              slug: 'deacon',               scope: 'BRANCH',      isSystem: false },
    { name: 'Auxiliary Leader',    slug: 'auxiliary-leader',     scope: 'BRANCH',      isSystem: false },
    { name: 'Auxiliary Member',    slug: 'auxiliary-member',     scope: 'BRANCH',      isSystem: false },
    { name: 'Marketplace Seller',  slug: 'marketplace-seller',   scope: 'GLOBAL',      isSystem: false },
    { name: 'Job Poster',          slug: 'job-poster',           scope: 'GLOBAL',      isSystem: false },
    { name: 'Song Uploader',       slug: 'song-uploader',        scope: 'GLOBAL',      isSystem: false },
    { name: 'Verified Member',     slug: 'verified-member',      scope: 'GLOBAL',      isSystem: true  },
    { name: 'Unverified Member',   slug: 'unverified-member',    scope: 'GLOBAL',      isSystem: true  },
    { name: 'Public Visitor',      slug: 'public-visitor',       scope: 'GLOBAL',      isSystem: true  },
  ] as const;

  const roleMap: Record<string, any> = {};
  for (const role of roleDefs) {
    const r = await prisma.role.upsert({ where: { slug: role.slug }, update: {}, create: { name: role.name, slug: role.slug, scope: role.scope as any, isSystem: role.isSystem } });
    roleMap[role.slug] = r;
  }
  console.log('✓ Roles seeded');

  // ── USERS ────────────────────────────────────────────────────────────────
  async function createUser(email: string, firstName: string, surname: string, roleSlugs: string[], cityTown = 'Johannesburg') {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash('Church@123', 12),
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        isEmailVerified: true,
        profile: {
          create: {
            firstName, surname,
            isProfileComplete: true,
            consentGiven: true,
            countryId: za.id,
            cityTown,
            baptismDate: new Date('2010-01-15'),
            baptismPlace: 'Johannesburg',
          },
        },
      },
    });
    for (const slug of roleSlugs) {
      if (roleMap[slug]) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: roleMap[slug].id } },
          update: {},
          create: { userId: user.id, roleId: roleMap[slug].id },
        }).catch(() => null);
      }
    }
    await prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: {},
      create: { tenantId: tenant.id, userId: user.id },
    }).catch(() => null);
    return user;
  }

  const superAdmin    = await createUser('superadmin@church.org',  'Super',    'Admin',       ['global-super-admin', 'super-admin']);
  const platformAdmin = await createUser('admin@church.org',        'Platform', 'Admin',       ['platform-admin']);
  const branchAdmin   = await createUser('branchadmin@church.org',  'Branch',   'Admin',       ['branch-admin', 'verified-member']);
  const minister1     = await createUser('minister1@church.org',    'Elder',    'Nkosi',       ['minister', 'verified-member']);
  const verifiedMbr   = await createUser('member@church.org',       'Grace',    'Dlamini',     ['verified-member']);
  const unverifiedMbr = await createUser('newmember@church.org',    'John',     'Mokoena',     ['unverified-member']);
  const seller1       = await createUser('seller@church.org',       'Faith',    'Enterprises', ['marketplace-seller', 'verified-member']);
  console.log('✓ Users seeded');

  // ── BRANCHES ─────────────────────────────────────────────────────────────
  const joburgBranch = await prisma.branch.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'johannesburg-main' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Johannesburg Main Branch',
      slug: 'johannesburg-main',
      type: 'MAIN',
      countryId: za.id,
      provinceId: gauteng.id,
      cityId: joburg?.id,
      estimatedMembers: 450,
      isActive: true,
      status: 'PUBLISHED',
      address: '123 Church Street, Johannesburg, 2000',
      googleMapsUrl: 'https://maps.google.com/?q=Johannesburg',
      leadership: {
        create: [
          { name: 'Elder Nkosi',    position: 'Overseer',        order: 1 },
          { name: 'Bro. Sithole',   position: 'Deacon',          order: 2 },
          { name: 'Sis. Mokoena',   position: 'Auxiliary Leader', order: 3 },
        ],
      },
      serviceTimes: {
        create: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '12:00', label: 'Sunday Morning' },
          { dayOfWeek: 3, startTime: '18:30', endTime: '20:00', label: 'Wednesday Bible Study' },
        ],
      },
      prayerSchedules: {
        create: [{ dayOfWeek: 5, time: '06:00', description: 'Friday Morning Prayer', isActive: true }],
      },
    },
  });

  const capeTownBranch = await prisma.branch.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'cape-town-main' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Cape Town Main Branch',
      slug: 'cape-town-main',
      type: 'MAIN',
      countryId: za.id,
      provinceId: westernCape.id,
      cityId: capeTown?.id,
      estimatedMembers: 280,
      isActive: true,
      status: 'PUBLISHED',
      address: '45 Gospel Avenue, Cape Town, 8001',
      googleMapsUrl: 'https://maps.google.com/?q=Cape+Town',
      serviceTimes: { create: [{ dayOfWeek: 0, startTime: '09:00', endTime: '12:00', label: 'Sunday Service' }] },
    },
  });

  await prisma.branch.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'kimberley-sub' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Kimberley Sub-branch',
      slug: 'kimberley-sub',
      type: 'SUB',
      parentBranchId: capeTownBranch.id,
      countryId: za.id,
      estimatedMembers: 85,
      isActive: true,
      status: 'PUBLISHED',
      serviceTimes: { create: [{ dayOfWeek: 0, startTime: '10:00', endTime: '12:30', label: 'Sunday Service' }] },
    },
  });
  console.log('✓ Branches seeded');

  // ── FEATURE FLAGS ─────────────────────────────────────────────────────────
  const flagDefs = [
    { key: 'home',          module: 'HOME',          isEnabled: true  },
    { key: 'profile',       module: 'PROFILE',       isEnabled: true  },
    { key: 'regions',       module: 'REGIONS',       isEnabled: true  },
    { key: 'branches',      module: 'BRANCHES',      isEnabled: true  },
    { key: 'announcements', module: 'ANNOUNCEMENTS', isEnabled: true  },
    { key: 'messaging',     module: 'MESSAGING',     isEnabled: false },
    { key: 'marketplace',   module: 'MARKETPLACE',   isEnabled: false },
    { key: 'jobs',          module: 'JOBS',          isEnabled: false },
    { key: 'sermons',       module: 'SERMONS',       isEnabled: false },
    { key: 'praise_songs',  module: 'PRAISE_SONGS',  isEnabled: false },
  ] as const;

  for (const flag of flagDefs) {
    // Use raw upsert with tenantId as a relation connect
    await prisma.featureFlag.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: flag.key } },
      update: { isEnabled: flag.isEnabled },
      create: {
        key: flag.key,
        module: flag.module as any,
        isEnabled: flag.isEnabled,
        description: `${flag.key} module`,
        tenant: { connect: { id: tenant.id } },
      },
    });
  }
  console.log('✓ Feature flags seeded');

  // ── EVENT COUNTDOWN ───────────────────────────────────────────────────────
  await prisma.eventCountdownConfig.create({
    data: {
      tenantId: tenant.id,
      title: 'Annual Convention',
      eventDate: new Date(`${new Date().getFullYear()}-08-06T09:00:00`),
      description: 'Join us for our annual gathering of faith, worship, and the Word.',
      ctaLabel: 'Book Accommodation',
      bookingUrl: 'https://booking.example.com',
      mapsUrl: 'https://maps.google.com/?q=Johannesburg+Convention+Centre',
      isActive: true,
    },
  }).catch(() => null);

  // ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    skipDuplicates: true,
    data: [
      { tenantId: tenant.id, title: 'Convention Registration Now Open', content: 'Registration for the Annual Convention on 6 August is now open. Please register early to secure your place and accommodation.', category: 'event',  status: 'PUBLISHED', isPinned: true,  isGlobal: true, publishedAt: new Date(), createdBy: superAdmin.id },
      { tenantId: tenant.id, title: 'Baptism Service — Johannesburg',   content: '12 members were baptized at the Johannesburg Main Branch last Sunday. Praise God for the growth of His Kingdom.',                               category: 'baptism',status: 'PUBLISHED', isPinned: false, isGlobal: true, publishedAt: new Date(), createdBy: branchAdmin.id },
      { tenantId: tenant.id, title: 'Sunday Service Time Update',        content: 'The Sunday service at the Cape Town Main Branch will begin at 09:30 from next month. Please update your schedules.',                           category: 'changes',status: 'PUBLISHED', isPinned: false, isGlobal: true, publishedAt: new Date(), createdBy: branchAdmin.id },
      { tenantId: tenant.id, title: 'Fasting Period: July Week 2',       content: 'The scheduled fasting period for all branches is the second week of July. Prayer meetings will be held each morning at 06:00.',                category: 'general',status: 'PUBLISHED', isPinned: true,  isGlobal: true, publishedAt: new Date(), createdBy: superAdmin.id },
    ],
  });
  console.log('✓ Announcements seeded');

  // ── BRANCH RECORDS ────────────────────────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    await prisma.branchRecord.create({
      data: {
        branchId: joburgBranch.id,
        date: d,
        membersPresent: Math.floor(Math.random() * 100) + 280,
        serviceDuration: 180,
        preacher: 'Elder Nkosi',
        offeringAmount: parseFloat((Math.random() * 5000 + 2000).toFixed(2)),
        numberBaptized: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0,
        notes: 'Service conducted as scheduled.',
        createdBy: branchAdmin.id,
      },
    }).catch(() => null);
  }
  console.log('✓ Branch records seeded');

  // ── MARKETPLACE ───────────────────────────────────────────────────────────
  const store = await prisma.marketplaceStore.upsert({
    where: { userId: seller1.id },
    update: {},
    create: {
      userId: seller1.id,
      tenantId: tenant.id,
      name: 'Faith Enterprises',
      slug: 'faith-enterprises',
      description: 'Quality Christian books, apparel, and resources.',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
      companyRegNumber: '2020/123456/07',
    },
  });
  const cat = await prisma.productCategory.upsert({ where: { slug: 'books' }, update: {}, create: { name: 'Books', slug: 'books' } });
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { storeId: store.id, categoryId: cat.id, title: 'Bible Study Guide Vol. 1', description: 'Comprehensive study guide for new believers.', price: 150, stockQty: 50, status: 'PUBLISHED' },
      { storeId: store.id, categoryId: cat.id, title: 'Prayer Journal',            description: 'Guided prayer and reflection journal.',         price: 85,  stockQty: 120, status: 'PUBLISHED' },
    ],
  });
  console.log('✓ Marketplace seeded');

  // ── EMAIL TEMPLATES ───────────────────────────────────────────────────────
  await prisma.emailTemplate.createMany({
    skipDuplicates: true,
    data: [
      { slug: 'order-confirmation',    name: 'Order Confirmation',    subject: 'Your Order #{{orderNumber}} is Confirmed',  htmlBody: '<h1>Thank you for your order!</h1><p>Order: {{orderNumber}}</p><p>Total: {{totalAmount}}</p>',          textBody: 'Thank you! Order: {{orderNumber}} Total: {{totalAmount}}',     variables: ['orderNumber','totalAmount','buyerName','orderDate'], isSystem: true },
      { slug: 'welcome',               name: 'Welcome Email',         subject: 'Welcome to Church Platform',                htmlBody: '<h1>Welcome, {{firstName}}!</h1><p>Complete your profile to access all features.</p>',                  textBody: 'Welcome, {{firstName}}! Please complete your profile.',         variables: ['firstName','profileUrl'],                             isSystem: true },
      { slug: 'verification-approved', name: 'Verification Approved', subject: 'Your membership has been verified',         htmlBody: '<h1>Congratulations, {{firstName}}!</h1><p>Your membership has been verified.</p>',                      textBody: 'Your membership has been verified.',                            variables: ['firstName'],                                          isSystem: true },
    ],
  });
  console.log('✓ Email templates seeded');

  // ── COMPLIANCE ────────────────────────────────────────────────────────────
  await prisma.countryComplianceProfile.upsert({
    where: { countryId: za.id },
    update: {},
    create: { countryId: za.id, requiresCompanyReg: true, requiresTaxDoc: true, requiresIdDoc: true, privacyLaw: 'POPIA', notes: 'South Africa: POPIA compliance required.' },
  });

  // ── AUDIT LOG ─────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: { userId: superAdmin.id, action: 'CREATE', entityType: 'Tenant', entityId: tenant.id, metadata: { event: 'Initial platform setup', version: '1.0.0' } },
  });

  console.log(`
✅ Seed complete!

Test accounts (password: Church@123):
  superadmin@church.org    — Global Super Admin
  admin@church.org         — Platform Admin
  branchadmin@church.org   — Branch Admin
  minister1@church.org     — Minister
  member@church.org        — Verified Member
  newmember@church.org     — Unverified Member
  seller@church.org        — Marketplace Seller
  `);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
