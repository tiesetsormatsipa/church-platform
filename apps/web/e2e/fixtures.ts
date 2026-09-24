import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export const DEMO_PASSWORD = 'Church-Demo-2026!';

/** One demo account per project, so parallel desktop and mobile runs never edit the same profile. */
export const USERS = {
  desktop: { email: 'member@example.org', storageState: 'e2e/.auth/desktop.json' },
  mobile: { email: 'newmember@example.org', storageState: 'e2e/.auth/mobile.json' },
} as const;

export function userFor(testInfo: TestInfo) {
  return testInfo.project.name === 'mobile' ? USERS.mobile : USERS.desktop;
}

/** Fails the test on WCAG 2.2 A/AA violations reported by axe. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(summary, 'accessibility violations').toEqual([]);
}
