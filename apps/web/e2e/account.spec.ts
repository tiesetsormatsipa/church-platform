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
    const next = original === 'Edited by E2E' ? 'Edited by E2E again' : 'Edited by E2E';
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

    // Put the demo account back as it was.
    await expect(async () => {
      await page.getByLabel('Name shown to others').fill(original);
      await expect(save).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await save.click();
    await expect(page.getByText('Profile saved')).toBeVisible();
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

test.describe('creating an account', () => {
  test('will not let a mistyped password through', async ({ page }) => {
    await page.goto('/sign-up');
    const submit = page.getByRole('button', { name: /Create account/i });
    await expect(submit).toBeEnabled();

    await page.getByLabel('First name').fill('Wendy');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('E-mail address').fill('never-created@example.org');
    await page.getByLabel('Password', { exact: true }).fill('E2E-Signup-2026!');
    // The kind of slip that otherwise leaves someone locked out of a brand-new account.
    await page.getByLabel('Repeat the password').fill('E2E-Signup-2026');
    await page.getByRole('checkbox').check();
    await submit.click();

    await expect(page.getByText('Those passwords do not match')).toBeVisible();
    // And nothing was sent: the account was never created.
    await expect(page.getByRole('heading', { name: 'Check your e-mail' })).toHaveCount(0);
  });
});
