/**
 * Demo data for development, previews and end-to-end tests. Never run in production.
 *
 * Branch names follow the labels of the live site (Global is a scope, not a branch). The
 * original labels are kept in `legacyLabel` so presentation fixes stay visible.
 * All people, e-mail addresses (example.org) and texts are fictional.
 */
import type { ContentScope, ContentStatus, ContentType } from '@church/shared';
import { hashPassword } from '@church/infrastructure/password';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { BaseSeedResult, SeedLogger } from './base.js';

export const DEMO_PASSWORD = 'Church-Demo-2026!';

export const DEMO_USERS = {
  superAdmin: 'superadmin@example.org',
  churchAdmin: 'admin@example.org',
  johannesburgAdmin: 'jhb.admin@example.org',
  capeTownEditor: 'ct.editor@example.org',
  member: 'member@example.org',
  pendingMember: 'newmember@example.org',
} as const;

/**
 * The church's real shape (ROADMAP_V2 §1): one tree, with country as an attribute rather
 * than a level. Johannesburg and Cape Town stand on their own; everything else sits beneath
 * one of them, including Windhoek, which is in Namibia but under Johannesburg's oversight.
 * Coordinates come from the branches' own addresses in the legacy system.
 */
const BRANCHES = [
  {
    slug: 'johannesburg',
    name: 'Johannesburg',
    legacyLabel: 'Johanessburg',
    city: 'Johannesburg',
    province: 'Gauteng',
    countryCode: 'ZA',
    type: 'MAIN',
    parent: null,
    latitude: -26.201785,
    longitude: 28.249182,
    sortOrder: 1,
  },
  {
    slug: 'cape-town',
    name: 'Cape Town',
    legacyLabel: 'CapeTown',
    city: 'Cape Town',
    province: 'Western Cape',
    countryCode: 'ZA',
    type: 'MAIN',
    parent: null,
    latitude: -33.906512,
    longitude: 18.562806,
    sortOrder: 2,
  },
  {
    slug: 'pretoria',
    name: 'Pretoria',
    legacyLabel: 'PTA',
    city: 'Pretoria',
    province: 'Gauteng',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'johannesburg',
    latitude: -25.747868,
    longitude: 28.139397,
    sortOrder: 3,
  },
  {
    slug: 'durban',
    name: 'Durban',
    legacyLabel: 'Durban',
    city: 'Durban',
    province: 'KwaZulu-Natal',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'johannesburg',
    latitude: -29.891023,
    longitude: 30.960472,
    sortOrder: 4,
  },
  {
    slug: 'windhoek',
    name: 'Windhoek',
    legacyLabel: null,
    city: 'Windhoek',
    province: 'Khomas',
    countryCode: 'NA',
    type: 'SUB',
    parent: 'johannesburg',
    latitude: -22.559722,
    longitude: 17.083206,
    sortOrder: 5,
  },
  {
    slug: 'kimberley',
    name: 'Kimberley',
    legacyLabel: 'Kimberley',
    city: 'Kimberley',
    province: 'Northern Cape',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'cape-town',
    latitude: -28.728175,
    longitude: 24.749898,
    sortOrder: 6,
  },
  {
    slug: 'upington',
    name: 'Upington',
    legacyLabel: null,
    city: 'Upington',
    province: 'Northern Cape',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'cape-town',
    latitude: -28.44775,
    longitude: 21.2561,
    sortOrder: 7,
  },
  {
    slug: 'springbok',
    name: 'Springbok',
    legacyLabel: null,
    city: 'Springbok',
    province: 'Northern Cape',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'cape-town',
    latitude: -29.6643,
    longitude: 17.8865,
    sortOrder: 8,
  },
  {
    slug: 'victoria-west',
    name: 'Victoria West',
    legacyLabel: null,
    city: 'Victoria West',
    province: 'Northern Cape',
    countryCode: 'ZA',
    type: 'SUB',
    parent: 'cape-town',
    latitude: -31.3967,
    longitude: 23.1158,
    sortOrder: 9,
  },
] as const;

type BranchSlug = (typeof BRANCHES)[number]['slug'];

const DAY = 24 * 60 * 60 * 1000;

/** A wall-clock time in South Africa (UTC+2, no daylight saving) `days` from today. */
function sast(days: number, time: string, now = new Date()): Date {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + days,
      (h ?? 0) - 2,
      m ?? 0,
    ),
  );
  return date;
}

function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * DAY);
}

/** The next occurrence of a calendar date (month is 1-based) at 09:00 SAST. */
function nextAnnual(month: number, day: number, now = new Date()): Date {
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day, 7, 0));
  return thisYear > now
    ? thisYear
    : new Date(Date.UTC(now.getUTCFullYear() + 1, month - 1, day, 7, 0));
}

export async function seedDemo(
  prisma: PrismaClient,
  base: BaseSeedResult,
  log: SeedLogger = () => {},
) {
  const org = base.organization;
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- Branches --------------------------------------------------------------------------
  const branches = {} as Record<BranchSlug, { id: string; name: string }>;
  // BRANCHES lists parents before their children, so a parent's id is always known by then.
  for (const b of BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: b.slug } },
      // Structure converges on re-seed (the demo tree is the point); descriptive fields an
      // administrator may have edited are left alone.
      update: {
        type: b.type,
        countryCode: b.countryCode,
        latitude: b.latitude,
        longitude: b.longitude,
        parentBranchId: b.parent ? branches[b.parent].id : null,
        sortOrder: b.sortOrder,
      },
      create: {
        organizationId: org.id,
        slug: b.slug,
        name: b.name,
        legacyLabel: b.legacyLabel,
        type: b.type,
        city: b.city,
        province: b.province,
        countryCode: b.countryCode,
        latitude: b.latitude,
        longitude: b.longitude,
        parentBranchId: b.parent ? branches[b.parent].id : null,
        sortOrder: b.sortOrder,
        description: `The ${b.name} branch meets every Sunday. Visitors are always welcome.`,
      },
    });
    branches[b.slug] = { id: branch.id, name: branch.name };
  }
  log(`branches: ${Object.keys(branches).join(', ')}`);

  // --- Baptism numbers -------------------------------------------------------------------
  // The church records a number after a service rather than running baptism days, so these
  // are scattered Sundays across the last two years with plausible sizes per branch.
  const baptismCount = await prisma.branchBaptismRecord.count({
    where: { branch: { organizationId: org.id } },
  });
  if (baptismCount === 0) {
    const thisYear = new Date().getUTCFullYear();
    const perBranch: Record<BranchSlug, number[]> = {
      johannesburg: [7, 4, 11, 6, 9, 5],
      'cape-town': [5, 8, 3, 6, 4],
      pretoria: [3, 2, 4],
      durban: [4, 6, 2],
      windhoek: [2, 3],
      kimberley: [2, 1, 3],
      upington: [1, 2],
      springbok: [2],
      'victoria-west': [1, 1],
    };
    const rows: Prisma.BranchBaptismRecordCreateManyInput[] = [];
    for (const [slug, counts] of Object.entries(perBranch) as [BranchSlug, number[]][]) {
      counts.forEach((count, index) => {
        // Spread them backwards over Sundays, so both this year and last year have entries.
        const weeksAgo = index * 9 + 2;
        const day = new Date(Date.UTC(thisYear, new Date().getUTCMonth(), new Date().getUTCDate()));
        day.setUTCDate(day.getUTCDate() - weeksAgo * 7);
        day.setUTCDate(day.getUTCDate() - day.getUTCDay()); // land on a Sunday
        rows.push({ branchId: branches[slug].id, occurredOn: day, count });
      });
    }
    await prisma.branchBaptismRecord.createMany({ data: rows });
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    log(`baptism records: ${rows.length} entries, ${total} people`);
  }

  const scheduleCount = await prisma.branchSchedule.count({
    where: { branch: { organizationId: org.id } },
  });
  if (scheduleCount === 0) {
    const schedules: Prisma.BranchScheduleCreateManyInput[] = [];
    for (const b of BRANCHES) {
      schedules.push({
        branchId: branches[b.slug].id,
        kind: 'SERVICE',
        title: 'Sunday service',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '12:00',
        sortOrder: 1,
      });
    }
    schedules.push(
      {
        branchId: branches.johannesburg.id,
        kind: 'BIBLE_STUDY',
        title: 'Bible study',
        dayOfWeek: 3,
        startTime: '18:30',
        endTime: '20:00',
        sortOrder: 2,
      },
      {
        branchId: branches.johannesburg.id,
        kind: 'PRAYER',
        title: 'Morning prayer',
        dayOfWeek: 5,
        startTime: '06:00',
        endTime: '07:00',
        sortOrder: 3,
      },
      {
        branchId: branches.johannesburg.id,
        kind: 'FASTING',
        title: 'Church-wide fast',
        recurrenceText: 'Second week of July',
        sortOrder: 4,
      },
      {
        branchId: branches.pretoria.id,
        kind: 'BIBLE_STUDY',
        title: 'Bible study',
        dayOfWeek: 3,
        startTime: '18:30',
        endTime: '20:00',
        sortOrder: 2,
      },
      {
        branchId: branches['cape-town'].id,
        kind: 'YOUTH',
        title: 'Youth fellowship',
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '16:00',
        sortOrder: 2,
      },
      {
        branchId: branches['cape-town'].id,
        kind: 'SERVICE',
        title: 'Sunday service (new time)',
        dayOfWeek: 0,
        startTime: '09:30',
        endTime: '12:00',
        effectiveFrom: daysAgo(3),
        effectiveUntil: new Date(Date.now() + 60 * DAY),
        replacesRegular: true,
        notes: 'Temporary change while the hall is renovated.',
        sortOrder: 0,
      },
    );
    await prisma.branchSchedule.createMany({ data: schedules });

    await prisma.branchLeader.createMany({
      data: [
        {
          branchId: branches.johannesburg.id,
          name: 'Elder T. Nkosi',
          title: 'Overseer',
          sortOrder: 1,
        },
        {
          branchId: branches.johannesburg.id,
          name: 'Bro. S. Sithole',
          title: 'Deacon',
          sortOrder: 2,
        },
        {
          branchId: branches.johannesburg.id,
          name: 'Sis. L. Mokoena',
          title: 'Auxiliary leader',
          sortOrder: 3,
        },
        {
          branchId: branches['cape-town'].id,
          name: 'Minister G. Dlamini',
          title: 'Minister',
          sortOrder: 1,
        },
      ],
    });
  }

  // --- People ----------------------------------------------------------------------------
  async function person(
    email: string,
    firstName: string,
    lastName: string,
    homeBranch?: BranchSlug,
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        passwordHash,
        passwordChangedAt: new Date(),
        profile: {
          create: {
            firstName,
            lastName,
            homeBranchId: homeBranch ? branches[homeBranch].id : null,
            termsAcceptedAt: new Date(),
            privacyConsentAt: new Date(),
          },
        },
      },
    });
  }

  async function grant(
    userId: string,
    roleKey: keyof BaseSeedResult['roles'],
    branch?: BranchSlug,
  ) {
    const branchId = branch ? branches[branch].id : null;
    const roleId = base.roles[roleKey].id;
    const exists = await prisma.roleAssignment.findFirst({ where: { userId, roleId, branchId } });
    if (!exists) {
      await prisma.roleAssignment.create({
        data: { userId, roleId, branchId, organizationId: org.id },
      });
    }
  }

  async function membership(userId: string, branch: BranchSlug, status: 'ACTIVE' | 'PENDING') {
    await prisma.branchMembership.upsert({
      where: { userId_branchId: { userId, branchId: branches[branch].id } },
      update: {},
      create: {
        userId,
        branchId: branches[branch].id,
        status,
        isPrimary: true,
        decidedAt: status === 'ACTIVE' ? daysAgo(30) : null,
        message: status === 'PENDING' ? 'I have been attending for three months.' : null,
      },
    });
  }

  const superAdmin = await person(DEMO_USERS.superAdmin, 'Super', 'Admin');
  const churchAdmin = await person(DEMO_USERS.churchAdmin, 'Naledi', 'Khumalo');
  const jhbAdmin = await person(DEMO_USERS.johannesburgAdmin, 'Sipho', 'Nkosi', 'johannesburg');
  const ctEditor = await person(DEMO_USERS.capeTownEditor, 'Anele', 'Jacobs', 'cape-town');
  const member = await person(DEMO_USERS.member, 'Grace', 'Dlamini', 'johannesburg');
  const pending = await person(DEMO_USERS.pendingMember, 'John', 'Mokoena', 'cape-town');

  await grant(superAdmin.id, 'super_admin');
  await grant(churchAdmin.id, 'church_admin');
  await grant(jhbAdmin.id, 'branch_admin', 'johannesburg');
  await grant(ctEditor.id, 'branch_editor', 'cape-town');
  await membership(jhbAdmin.id, 'johannesburg', 'ACTIVE');
  await membership(member.id, 'johannesburg', 'ACTIVE');
  await membership(pending.id, 'cape-town', 'PENDING');
  log(`demo users (password ${DEMO_PASSWORD}): ${Object.values(DEMO_USERS).join(', ')}`);

  // --- Sermon library ----------------------------------------------------------------------
  const speakerNkosi = await prisma.speaker.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'elder-t-nkosi' } },
    update: {},
    create: {
      organizationId: org.id,
      slug: 'elder-t-nkosi',
      name: 'Elder T. Nkosi',
      title: 'Overseer',
      branchId: branches.johannesburg.id,
    },
  });
  const speakerDlamini = await prisma.speaker.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'minister-g-dlamini' } },
    update: {},
    create: {
      organizationId: org.id,
      slug: 'minister-g-dlamini',
      name: 'Minister G. Dlamini',
      title: 'Minister',
      branchId: branches['cape-town'].id,
    },
  });
  const seriesActs = await prisma.sermonSeries.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'the-early-church' } },
    update: {},
    create: {
      organizationId: org.id,
      slug: 'the-early-church',
      title: 'The early church',
      description: 'A journey through the book of Acts.',
    },
  });

  const tagNames = ['Prayer', 'Faith', 'Holy Spirit', 'Youth', 'Convention'];
  const tags: Record<string, string> = {};
  for (const name of tagNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const tag = await prisma.tag.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      update: {},
      create: { organizationId: org.id, slug, name },
    });
    tags[name] = tag.id;
  }

  // --- Content -----------------------------------------------------------------------------
  interface DemoContent {
    slug: string;
    type: ContentType;
    scope: ContentScope;
    branch?: BranchSlug;
    title: string;
    summary?: string;
    body: string;
    status?: ContentStatus;
    publishedAt?: Date | null;
    isPinned?: boolean;
    isFeatured?: boolean;
    authorId: string;
    tags?: string[];
    event?: Omit<Prisma.EventDetailCreateWithoutContentInput, 'content'>;
    sermon?: Omit<Prisma.SermonDetailUncheckedCreateWithoutContentInput, 'content'>;
    song?: Omit<Prisma.SongDetailUncheckedCreateWithoutContentInput, 'content'>;
    collection?: 'LOCAL' | 'TOG' | 'HOLY_CONVOCATION';
    baptism?: Omit<Prisma.BaptismDetailCreateWithoutContentInput, 'content'>;
  }

  const convention = nextAnnual(8, 6);
  const content: DemoContent[] = [
    {
      slug: 'annual-convention-registration-open',
      type: 'ANNOUNCEMENT',
      scope: 'GLOBAL',
      title: 'Annual Convention registration is open',
      summary: 'Register early to secure your place and accommodation.',
      body: 'Registration for the **Annual Convention** is now open. Please register early to secure your place and accommodation.\n\nBranch administrators will share transport arrangements closer to the time.',
      publishedAt: daysAgo(2),
      isPinned: true,
      authorId: churchAdmin.id,
      tags: ['Convention'],
    },
    {
      slug: 'church-wide-fast-july',
      type: 'ANNOUNCEMENT',
      scope: 'GLOBAL',
      title: 'Church-wide fast in the second week of July',
      summary: 'Prayer meetings will be held each morning at 06:00.',
      body: 'The scheduled fasting period for all branches is the second week of July. Prayer meetings will be held each morning at 06:00 at every branch.',
      publishedAt: daysAgo(9),
      authorId: churchAdmin.id,
      tags: ['Prayer'],
    },
    {
      slug: 'cape-town-sunday-service-time',
      type: 'ANNOUNCEMENT',
      scope: 'BRANCH',
      branch: 'cape-town',
      title: 'Sunday service now starts at 09:30',
      summary: 'A temporary change while the hall is renovated.',
      body: 'From this Sunday, the Cape Town service begins at **09:30** while the hall is being renovated. We will announce when the regular time resumes.',
      publishedAt: daysAgo(3),
      authorId: ctEditor.id,
    },
    {
      slug: 'annual-convention',
      type: 'EVENT',
      scope: 'GLOBAL',
      title: 'Annual Convention',
      summary: 'Our yearly gathering of all branches for worship, the Word and fellowship.',
      body: 'Join the whole church for three days of worship, preaching and fellowship.\n\n- Registration opens at 08:00 each day\n- Services at 09:00 and 15:00\n- Youth programme on Saturday afternoon',
      publishedAt: daysAgo(20),
      isFeatured: true,
      authorId: churchAdmin.id,
      tags: ['Convention'],
      event: {
        startsAt: convention,
        endsAt: new Date(convention.getTime() + 2 * DAY + 9 * 60 * 60 * 1000),
        category: 'CONFERENCE',
        venueName: 'Venue to be announced',
        venueAddress: 'Johannesburg, Gauteng',
      },
    },
    {
      slug: 'johannesburg-baptism-service',
      type: 'EVENT',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: 'Baptism service',
      summary: 'Candidates meet at 09:00 for preparation.',
      body: 'A baptism service will be held after the Sunday service. Candidates should arrive by 09:00 and bring a change of clothes.\n\nIf you would like to be baptised, speak to the branch leadership or use the enquiry form on the Baptism page.',
      publishedAt: daysAgo(5),
      authorId: jhbAdmin.id,
      event: {
        startsAt: sast(12, '12:30'),
        endsAt: sast(12, '14:00'),
        category: 'BAPTISM',
        venueName: 'Johannesburg branch',
      },
    },
    {
      slug: 'durban-youth-evening',
      type: 'EVENT',
      scope: 'BRANCH',
      branch: 'durban',
      title: 'Youth fellowship evening',
      summary: 'An evening of songs, testimonies and a short message for young people.',
      body: 'All young people are welcome. Bring a friend!',
      publishedAt: daysAgo(1),
      authorId: churchAdmin.id,
      tags: ['Youth'],
      event: {
        startsAt: sast(5, '17:00'),
        endsAt: sast(5, '19:30'),
        category: 'YOUTH',
        venueName: 'Durban branch hall',
      },
    },
    {
      slug: 'welcome-to-our-new-home-online',
      type: 'NEWS',
      scope: 'GLOBAL',
      title: 'Welcome to our new home online',
      summary: 'Everything happening across our branches, in one place.',
      body: [
        'We are glad to welcome you to the new church platform.',
        '',
        '## What you will find here',
        '',
        '- **Announcements** from the whole church and from your branch',
        '- **Events** with dates, times and directions',
        '- **Sermons** to listen to again',
        '- **Branch pages** with service times and leadership',
        '',
        '## Choose your branch',
        '',
        'Use the branch selector at the top of the page to see what is happening at your branch. Church-wide news is always shown, marked with a globe.',
      ].join('\n'),
      publishedAt: daysAgo(4),
      authorId: churchAdmin.id,
    },
    {
      slug: 'finding-service-times',
      type: 'NEWS',
      scope: 'GLOBAL',
      title: 'Finding service times near you',
      summary:
        'Every branch page now lists its services, prayer meetings and any temporary changes.',
      body: 'Open **Branches** and choose your branch. Temporary changes, such as a new Sunday start time, are highlighted until they end.',
      publishedAt: daysAgo(12),
      authorId: churchAdmin.id,
    },
    {
      slug: 'twelve-baptised-in-johannesburg',
      type: 'BAPTISM',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: 'Twelve baptised in Johannesburg',
      summary: 'We give thanks for twelve new believers baptised on Sunday.',
      body: 'Twelve candidates were baptised at the Johannesburg branch last Sunday. Praise God for the growth of His Kingdom. Please keep them in your prayers.',
      publishedAt: daysAgo(6),
      authorId: jhbAdmin.id,
      baptism: {
        baptismDate: daysAgo(7),
        candidatesCount: 12,
        officiantName: 'Elder T. Nkosi',
        location: 'Johannesburg branch',
      },
    },
    {
      slug: 'walking-in-the-light',
      type: 'SERMON',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: 'Walking in the light',
      summary: 'What it means to have fellowship with God and with one another.',
      body: 'A message on 1 John 1, on honesty before God and the fellowship that follows.',
      publishedAt: daysAgo(7),
      authorId: jhbAdmin.id,
      tags: ['Faith'],
      sermon: {
        preachedOn: daysAgo(7),
        speakerId: speakerNkosi.id,
        speakerName: speakerNkosi.name,
        scripture: '1 John 1:5–7',
        durationSeconds: 2_460,
      },
    },
    {
      slug: 'the-promise-of-the-spirit',
      type: 'SERMON',
      scope: 'GLOBAL',
      title: 'The promise of the Spirit',
      summary: 'Peter’s answer on the day of Pentecost, and what it means for us today.',
      body: 'Part one of our series through the book of Acts.',
      publishedAt: daysAgo(14),
      authorId: churchAdmin.id,
      tags: ['Holy Spirit'],
      sermon: {
        preachedOn: daysAgo(14),
        speakerId: speakerDlamini.id,
        speakerName: speakerDlamini.name,
        seriesId: seriesActs.id,
        scripture: 'Acts 2:37–39',
        durationSeconds: 2_880,
      },
    },
    {
      slug: 'faith-that-endures',
      type: 'SERMON',
      scope: 'GLOBAL',
      title: 'Faith that endures',
      summary: 'Lessons from the people of faith in Hebrews 11.',
      body: 'How the faith of those who went before us encourages us to keep going.',
      publishedAt: daysAgo(21),
      authorId: churchAdmin.id,
      tags: ['Faith'],
      sermon: {
        preachedOn: daysAgo(21),
        speakerId: speakerNkosi.id,
        speakerName: speakerNkosi.name,
        scripture: 'Hebrews 11:1–6',
        durationSeconds: 3_120,
      },
    },
    {
      slug: 'kimberley-choir-practice-saturdays',
      type: 'POST',
      scope: 'BRANCH',
      branch: 'kimberley',
      title: 'Choir practice moves to Saturdays',
      body: 'From next week, choir practice in Kimberley will be on Saturdays at 10:00. New voices are welcome.',
      publishedAt: daysAgo(1),
      authorId: churchAdmin.id,
    },
    {
      slug: 'easter-programme-draft',
      type: 'ANNOUNCEMENT',
      scope: 'GLOBAL',
      title: 'Easter programme',
      body: 'Draft: the programme will be confirmed at the next leadership meeting.',
      status: 'DRAFT',
      publishedAt: null,
      authorId: churchAdmin.id,
    },
    {
      slug: 'pretoria-prayer-evening',
      type: 'ANNOUNCEMENT',
      scope: 'BRANCH',
      branch: 'pretoria',
      title: 'Prayer evening next Friday',
      body: 'Scheduled announcement used to test scheduled publishing.',
      publishedAt: new Date(Date.now() + 2 * DAY),
      authorId: churchAdmin.id,
    },
    // --- Songs, and the two collections that stand above the branches -------------------
    {
      slug: 'i-will-bless-the-lord',
      type: 'SONG',
      scope: 'GLOBAL',
      title: 'I Will Bless the Lord',
      summary: 'Sung by the congregation at the close of the Sunday service.',
      body: 'A song the whole church knows, taken up without accompaniment.',
      publishedAt: daysAgo(6),
      authorId: churchAdmin.id,
      tags: ['Faith'],
      song: {
        artist: 'The congregation',
        album: 'Sunday Worship',
        trackNumber: 1,
        durationSeconds: 312,
        language: 'en',
        recordedOn: daysAgo(6),
      },
    },
    {
      slug: 'ngiyabonga-jesu',
      type: 'SONG',
      scope: 'BRANCH',
      branch: 'johannesburg',
      title: 'Ngiyabonga Jesu',
      summary: 'The Johannesburg choir, in isiZulu.',
      body: 'Recorded after the morning service.',
      publishedAt: daysAgo(12),
      authorId: jhbAdmin.id,
      song: {
        artist: 'Johannesburg choir',
        album: 'Sunday Worship',
        trackNumber: 2,
        durationSeconds: 268,
        language: 'zu',
        recordedOn: daysAgo(12),
      },
    },
    {
      slug: 'modimo-o-molemo',
      type: 'SONG',
      scope: 'BRANCH',
      branch: 'cape-town',
      title: 'Modimo o Molemo',
      summary: 'The Cape Town choir, in Sesotho.',
      body: 'Sung at the evening service.',
      publishedAt: daysAgo(20),
      authorId: churchAdmin.id,
      song: {
        artist: 'Cape Town choir',
        durationSeconds: 295,
        language: 'st',
        recordedOn: daysAgo(20),
      },
    },
    {
      slug: 'tog-the-blood-still-works',
      type: 'SONG',
      scope: 'GLOBAL',
      collection: 'TOG',
      title: 'The Blood Still Works',
      summary: 'From the headquarters.',
      body: 'Recorded at the Philadelphia headquarters.',
      publishedAt: daysAgo(30),
      authorId: superAdmin.id,
      song: {
        artist: 'Truth of God choir',
        album: 'Truth of God',
        trackNumber: 1,
        durationSeconds: 341,
        language: 'en',
        recordedOn: daysAgo(30),
      },
    },
    {
      slug: 'convocation-holy-holy-holy',
      type: 'SONG',
      scope: 'GLOBAL',
      collection: 'HOLY_CONVOCATION',
      title: 'Holy, Holy, Holy',
      summary: 'Sung by the choir during the Holy Convocation.',
      body: 'Recorded while the Apostle was travelling.',
      publishedAt: daysAgo(45),
      authorId: superAdmin.id,
      song: {
        artist: 'Convocation choir',
        album: 'Holy Convocation',
        trackNumber: 1,
        durationSeconds: 402,
        language: 'en',
        recordedOn: daysAgo(45),
      },
    },
    {
      slug: 'tog-the-truth-about-salvation',
      type: 'SERMON',
      scope: 'GLOBAL',
      collection: 'TOG',
      title: 'The Truth About Salvation',
      summary: 'From the headquarters, by the overseer.',
      body: 'Preached at the Philadelphia headquarters.',
      publishedAt: daysAgo(28),
      authorId: superAdmin.id,
      sermon: {
        preachedOn: daysAgo(28),
        speakerName: 'Apostle Pastor Gino Jennings',
        scripture: 'Acts 2:38',
        durationSeconds: 5_400,
        language: 'en',
      },
    },
    {
      slug: 'convocation-one-body-one-faith',
      type: 'SERMON',
      scope: 'GLOBAL',
      collection: 'HOLY_CONVOCATION',
      title: 'One Body, One Faith',
      summary: 'Preached during the Holy Convocation.',
      body: 'Recorded while the Apostle was travelling.',
      publishedAt: daysAgo(40),
      authorId: superAdmin.id,
      sermon: {
        preachedOn: daysAgo(40),
        speakerName: 'Apostle Pastor Gino Jennings',
        scripture: 'Ephesians 4:4–6',
        durationSeconds: 4_980,
        language: 'en',
      },
    },
  ];

  let created = 0;
  for (const item of content) {
    const exists = await prisma.contentItem.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug: item.slug } },
      select: { id: true },
    });
    if (exists) continue;
    const status = item.status ?? 'PUBLISHED';
    await prisma.contentItem.create({
      data: {
        organization: { connect: { id: org.id } },
        type: item.type,
        scope: item.scope,
        ...(item.branch ? { branch: { connect: { id: branches[item.branch].id } } } : {}),
        slug: item.slug,
        title: item.title,
        summary: item.summary ?? null,
        body: item.body,
        status,
        publishedAt: status === 'PUBLISHED' ? (item.publishedAt ?? new Date()) : null,
        isPinned: item.isPinned ?? false,
        isFeatured: item.isFeatured ?? false,
        author: { connect: { id: item.authorId } },
        createdBy: { connect: { id: item.authorId } },
        ...(status === 'PUBLISHED' ? { publishedBy: { connect: { id: item.authorId } } } : {}),
        ...(item.event ? { event: { create: item.event } } : {}),
        ...(item.sermon ? { sermon: { create: item.sermon } } : {}),
        ...(item.song ? { song: { create: item.song } } : {}),
        ...(item.collection ? { collection: item.collection } : {}),
        ...(item.baptism ? { baptism: { create: item.baptism } } : {}),
        ...(item.tags?.length
          ? {
              tags: { create: item.tags.map((name) => ({ tag: { connect: { id: tags[name] } } })) },
            }
          : {}),
      },
    });
    created += 1;
  }
  log(`content items: ${created} created, ${content.length - created} already present`);

  // --- Service record, notifications -----------------------------------------------------
  if (
    (await prisma.branchServiceRecord.count({ where: { branchId: branches.johannesburg.id } })) ===
    0
  ) {
    await prisma.branchServiceRecord.createMany({
      data: [7, 14, 21].map((d, i) => ({
        branchId: branches.johannesburg.id,
        serviceDate: daysAgo(d),
        serviceLabel: 'Sunday service',
        attendance: 310 - i * 12,
        durationMinutes: 180,
        preacherName: 'Elder T. Nkosi',
        offeringAmount: `${4200 - i * 150}.00`,
        baptismsCount: d === 7 ? 12 : 0,
        createdById: jhbAdmin.id,
      })),
    });
  }

  if ((await prisma.notification.count({ where: { userId: member.id } })) === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: member.id,
          category: 'MEMBERSHIP',
          title: 'Welcome to the Johannesburg branch',
          body: 'Your membership has been confirmed.',
          url: '/branches/johannesburg',
          dedupeKey: 'demo-membership',
          createdAt: daysAgo(30),
        },
        {
          userId: member.id,
          category: 'ANNOUNCEMENTS',
          title: 'Annual Convention registration is open',
          url: '/posts/annual-convention-registration-open',
          dedupeKey: 'demo-convention',
          createdAt: daysAgo(2),
        },
      ],
    });
  }

  return { branches, users: { superAdmin, churchAdmin, jhbAdmin, ctEditor, member, pending } };
}
