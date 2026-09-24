import { expect, test } from '@playwright/test';
import { adminFor, expectAccessible } from './fixtures';

test.use({ storageState: async ({}, use, testInfo) => use(adminFor(testInfo).storageState) });

test.describe('administration', () => {
  test('overview lists what needs attention', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Administration' })
        .getByRole('link', { name: /Content/ }),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test('an announcement can be drafted, published, seen publicly and deleted', async ({ page }) => {
    // Two round trips through the worker's cache revalidation; the default budget is tight.
    test.setTimeout(120_000);
    const title = `E2E notice ${Date.now().toString(36)}`;
    await page.goto('/admin/content/new?type=ANNOUNCEMENT');
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await expectAccessible(page);
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Summary').fill('Created by the end-to-end tests.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(
      page.getByLabel('Publishing').getByText('Published', { exact: true }),
    ).toBeVisible();

    const editor = page.url();
    const publicPath = await page
      .getByRole('link', { name: 'View on the site' })
      .getAttribute('href');
    expect(publicPath).toMatch(/^\/posts\/e2e-notice-/);
    await page.goto(publicPath!);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    // The worker revalidates the cached listings, so the feed shows it without waiting for
    // the 60-second cache to lapse (ADR-026).
    await expect(async () => {
      await page.goto('/feed');
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });

    await page.goto(editor);
    await page.getByRole('button', { name: 'Delete…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL(/\/admin\/content$/);
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);

    // …and disappears from the feed again once it is deleted.
    await expect(async () => {
      await page.goto('/feed');
      await expect(page.getByRole('link', { name: title })).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('event times are entered in South African time', async ({ page }) => {
    const title = `E2E event ${Date.now().toString(36)}`;
    await page.goto('/admin/content/new?type=EVENT');
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Starts').fill('2027-03-14T09:30');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.waitForURL(/\/admin\/content\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel('Starts')).toHaveValue('2027-03-14T09:30');
    await page.getByRole('button', { name: 'Delete…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL(/\/admin\/content$/);
  });

  test('a branch service time can be added and removed', async ({ page }, testInfo) => {
    const title = `E2E meeting ${testInfo.project.name} ${Date.now().toString(36)}`;
    await page.goto('/admin/branches/johannesburg');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Add a time' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /^Name/ }).fill(title);
    await dialog.getByLabel('Day').selectOption('4');
    await dialog.getByLabel('Starts').fill('19:00');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const removeButton = page.getByRole('button', { name: `Remove ${title}` });
    await expect(removeButton).toBeVisible();
    await expect(page.getByText('Thursday · 19:00').first()).toBeVisible();

    await removeButton.click();
    await expect(removeButton).toHaveCount(0);
  });

  test('people, memberships and enquiries pages are accessible', async ({ page }) => {
    for (const path of [
      '/admin/people',
      '/admin/memberships',
      '/admin/baptism',
      '/admin/content',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectAccessible(page);
    }
  });
});

test.describe('members', () => {
  test.use({
    storageState: async ({}, use, testInfo) =>
      use(testInfo.project.name === 'mobile' ? 'e2e/.auth/mobile.json' : 'e2e/.auth/desktop.json'),
  });

  test('see a friendly message instead of the admin area', async ({ page }) => {
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { level: 1, name: 'This area is for church administrators' }),
    ).toBeVisible();
  });
});
