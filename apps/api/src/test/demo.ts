import type { DatabaseClient } from '@church/database';
import { seedBase, seedDemo } from '@church/database/seed';

let seeded: Promise<Awaited<ReturnType<typeof seedDemo>>> | undefined;

/** Load the demo data set into the test organisation (once per test process). */
export function ensureDemoData(db: DatabaseClient) {
  seeded ??= (async () => {
    const base = await seedBase(db, { organization: { slug: 'test-church', name: 'Test Church' } });
    return seedDemo(db, base);
  })();
  return seeded;
}
