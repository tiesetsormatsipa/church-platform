import { expect, test } from '@playwright/test';
import { adminFor, expectAccessible, userFor } from './fixtures';

test.describe('the board, signed out', () => {
  test('is open to anyone', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: 'Jobs', level: 1 })).toBeVisible();
    // Posting is for members, so there is nothing inviting a visitor to try.
    await expect(page.getByRole('link', { name: 'Post an opening' })).toHaveCount(0);
    await expectAccessible(page);
  });

  test('sends you to sign in before you can post', async ({ page }) => {
    await page.goto('/profile/jobs');
    // The whole /profile section is guarded by its layout, which names itself as the
    // destination, so that is where signing in returns you.
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile/);
  });
});

test.describe('a member posting work', () => {
  test.use({ storageState: async ({}, use, testInfo) => use(userFor(testInfo).storageState) });

  test('puts it forward and waits to be read', async ({ page }) => {
    test.setTimeout(90_000);
    const title = `E2E opening ${Date.now().toString(36)}`;

    await page.goto('/profile/jobs');
    await page.getByRole('button', { name: 'Post an opening' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('What is the role?').fill(title);
    await dialog.getByLabel('Who is it for?').fill('E2E Trading');
    await dialog.getByLabel('Where?').fill('Johannesburg');
    await dialog.getByLabel('E-mail address').fill('work@example.org');
    await dialog.getByRole('button', { name: 'Send to be read' }).click();

    // It is listed as waiting, and says so plainly.
    const row = page.getByRole('listitem').filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText('Waiting to be read')).toBeVisible();
    await expectAccessible(page);

    // And it is not on the public board yet.
    await page.goto('/jobs');
    await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0);

    // Withdraw it again, so the run leaves nothing behind.
    await page.goto('/profile/jobs');
    const mine = page.getByRole('listitem').filter({ hasText: title });
    await mine.getByRole('button', { name: /^Withdraw/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Withdraw' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);
  });
});

test.describe('the administration area', () => {
  test.use({ storageState: async ({}, use, testInfo) => use(adminFor(testInfo).storageState) });

  test('lists job postings to review but does not offer to write one', async ({ page }) => {
    await page.goto('/admin/content?type=JOB');
    await expect(page.getByLabel('Kind')).toHaveValue('JOB');
    await expect(page.getByRole('link', { name: /New job/i })).toHaveCount(0);
    await expect(page.getByText('Members write these')).toBeVisible();
    await expectAccessible(page);
  });
});
