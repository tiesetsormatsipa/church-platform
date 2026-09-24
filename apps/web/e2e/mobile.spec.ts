import { expect, test } from '@playwright/test';

test('mobile navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/');
  const tabs = page.getByRole('navigation', { name: /main|primary|tab/i }).last();
  await expect(tabs).toBeVisible();
  await tabs.getByRole('link', { name: 'Events' }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Events' })).toBeVisible();
});
