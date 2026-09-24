import { expect, test as setup } from '@playwright/test';
import { DEMO_PASSWORD, USERS } from './fixtures';

for (const user of Object.values(USERS)) {
  setup(`sign in as ${user.email}`, async ({ page }) => {
    await page.goto('/sign-in?next=/profile');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await page.getByLabel('E-mail address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/profile');
    await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
    await page.context().storageState({ path: user.storageState });
  });
}
