import { expect, test } from '@playwright/test';
import { expectAccessible } from './fixtures';

/**
 * The worker's user-visible effects: a sign-up e-mail that really arrives and really works,
 * and the notification centre the header bell links to.
 *
 * The e-mail is read from Mailpit's API, so this covers the whole chain: API → `email`
 * queue → worker → SMTP → inbox → the link in the message.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/** Waits for a message to that address and returns its plain-text body. */
async function inboxText(address: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const search = new URL('/api/v1/search', MAILPIT);
    search.searchParams.set('query', `to:${address}`);
    const response = await fetch(search);
    if (response.ok) {
      const body = (await response.json()) as { messages: MailpitMessage[] };
      const message = body.messages[0];
      if (message) {
        const detail = await fetch(new URL(`/api/v1/message/${message.ID}`, MAILPIT));
        const full = (await detail.json()) as { Text: string };
        return full.Text;
      }
    }
    if (Date.now() > deadline)
      throw new Error(`No e-mail reached ${address} within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

test.describe('e-mail delivery', () => {
  // Sends a real message and polls an inbox, so it needs longer than the default budget.
  test.setTimeout(90_000);

  test('signing up delivers a code that confirms the account without leaving the page', async ({
    page,
  }, testInfo) => {
    // A distinct address per project, so desktop and mobile never read each other's mail.
    const address = `e2e-signup-${testInfo.project.name}-${Date.now().toString(36)}@example.org`;

    await page.goto('/sign-up');
    const submit = page.getByRole('button', { name: /Create account/i });
    await expect(submit).toBeEnabled();
    await page.getByLabel('First name').fill('Wendy');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('E-mail address').fill(address);
    await page.getByLabel('Password', { exact: true }).fill('E2E-Signup-2026!');
    await page.getByLabel('Repeat the password').fill('E2E-Signup-2026!');
    await page.getByRole('checkbox').check();
    await submit.click();

    await expect(page.getByRole('heading', { name: 'Check your e-mail' })).toBeVisible({
      timeout: 15_000,
    });

    const text = await inboxText(address);
    // The code is the main path now; the link is still there for the same-device case.
    const code = /Your confirmation code:\s*([0-9]{6})/.exec(text)?.[1];
    expect(code, 'a six-digit code in the e-mail').toBeTruthy();
    // Type the code, in the tab that is already open, the way most people will.
    await page.getByLabel(/digit code/i).fill(code!);
    await page.getByRole('button', { name: /Confirm and continue/i }).click();

    // Confirmed and signed in, without ever leaving the browser they signed up in: the
    // header stops offering to sign in, on both the desktop and the phone layout.
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('the link in the same e-mail also confirms the address', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const address = `e2e-signup-link-${testInfo.project.name}-${Date.now().toString(36)}@example.org`;

    await page.goto('/sign-up');
    const submit = page.getByRole('button', { name: /Create account/i });
    await expect(submit).toBeEnabled();
    await page.getByLabel('First name').fill('Wendy');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('E-mail address').fill(address);
    await page.getByLabel('Password', { exact: true }).fill('E2E-Signup-2026!');
    await page.getByLabel('Repeat the password').fill('E2E-Signup-2026!');
    await page.getByRole('checkbox').check();
    await submit.click();
    await expect(page.getByRole('heading', { name: 'Check your e-mail' })).toBeVisible({
      timeout: 15_000,
    });

    const text = await inboxText(address);
    const link = /https?:\/\/[^\s]*\/verify-email\?token=[A-Za-z0-9_.-]+/.exec(text)?.[0];
    expect(link, 'a verification link in the e-mail').toBeTruthy();
    const target = new URL(link!);
    await page.goto(target.pathname + target.search);
    await expect(
      page.getByText('Your e-mail address is confirmed and you are signed in.'),
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('notification centre', () => {
  test.use({
    storageState: async ({}, use, testInfo) =>
      use(testInfo.project.name === 'mobile' ? 'e2e/.auth/mobile.json' : 'e2e/.auth/desktop.json'),
  });

  test('is reachable and accessible', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expectAccessible(page);
  });

  test('signed-out visitors are sent to sign in', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
