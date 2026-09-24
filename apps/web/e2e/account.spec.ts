import { expect, test } from '@playwright/test';
import { expectAccessible, userFor } from './fixtures';

test.describe('signed out', () => {
  test('account pages ask you to sign in first', async ({ page }) => {
    await page.goto('/profile/security');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile/);
  });

  test('wrong password shows a clear message', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await page.getByLabel('E-mail address').fill('nobody@example.org');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'The e-mail address or password is incorrect.',
    );
    await expectAccessible(page);
  });
});

test.describe('signed in', () => {
  test.use({ storageState: async ({}, use, testInfo) => use(userFor(testInfo).storageState) });

  test('profile can be edited', async ({ page }) => {
    await page.goto('/profile');
    const field = page.getByLabel('Name shown to others');
    const save = page.getByRole('button', { name: 'Save changes' });
    const original = await field.inputValue();
    const next = original.endsWith('(e2e)')
      ? original.replace(' (e2e)', '')
      : `${original || 'Friend'} (e2e)`;
    // Save stays disabled until the form is hydrated and changed; retry typing until it is.
    await expect(async () => {
      await field.fill(next);
      await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await save.click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Name shown to others')).toHaveValue(next);
    await expectAccessible(page);
  });

  test('security page lists this device', async ({ page }) => {
    await page.goto('/profile/security');
    await expect(page.getByText('This device')).toBeVisible();
    await expectAccessible(page);
  });

  test('notification preferences keep security e-mail on', async ({ page }) => {
    await page.goto('/profile/notifications');
    await expect(
      page.getByRole('checkbox', { name: 'Account and security: e-mail (always on)' }),
    ).toBeDisabled();
    await expectAccessible(page);
  });
});
