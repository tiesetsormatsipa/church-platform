import { expect, test } from '@playwright/test';
import { expectAccessible } from './fixtures';

test.describe('public site', () => {
  test('home page shows the whole church and switches branch context', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest updates' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Choose a branch' })
      .getByRole('link', { name: 'Pretoria' })
      .click();
    await expect(page).toHaveURL(/\?branch=pretoria/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pretoria' })).toBeVisible();
    await expectAccessible(page);
  });

  test('feed filters by type', async ({ page }) => {
    await page.goto('/feed');
    await page
      .getByRole('navigation', { name: 'Filter by type' })
      .getByRole('link', { name: 'Sermons' })
      .click();
    await expect(page).toHaveURL(/types=sermon/);
    const cards = page.locator('main article');
    await expect(cards.first()).toBeVisible();
    for (const label of await cards.locator('span.uppercase').first().allTextContents())
      expect(label).toMatch(/sermon/i);
    await expectAccessible(page);
  });

  test('event detail offers a calendar file', async ({ page, request }) => {
    await page.goto('/events');
    await page.getByRole('link', { name: 'Annual Convention' }).click();
    await expect(page).toHaveURL(/\/events\/annual-convention$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Annual Convention' })).toBeVisible();
    const ics = page.getByRole('link', { name: 'Add to calendar' });
    await expect(ics).toHaveAttribute('href', '/events/annual-convention/calendar.ics');
    const response = await request.get('/events/annual-convention/calendar.ics');
    expect(response.headers()['content-type']).toContain('text/calendar');
    expect(await response.text()).toContain('SUMMARY:Annual Convention');
    await expectAccessible(page);
  });

  test('unknown pages return 404 and old URLs redirect', async ({ page }) => {
    const missing = await page.goto('/events/no-such-event');
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/couldn.t find/i);

    await page.goto('/posts/annual-convention');
    await expect(page).toHaveURL(/\/events\/annual-convention$/);
    await page.goto('/regions');
    await expect(page).toHaveURL(/\/branches$/);
  });

  test('branch page lists service times', async ({ page }) => {
    await page.goto('/branches');
    await page.getByRole('link', { name: 'Johannesburg', exact: true }).first().click();
    await expect(page).toHaveURL(/\/branches\/johannesburg$/);
    await expect(page.getByRole('heading', { name: 'Service times' })).toBeVisible();
    await expect(page.getByText('Sunday service')).toBeVisible();
    await expectAccessible(page);
  });

  test('search finds content', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('searchbox', { name: 'Search the site' }).fill('convention');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/q=convention/);
    await expect(page.getByRole('status')).toContainText('result');
    await expect(page.getByRole('link', { name: 'Annual Convention', exact: true })).toBeVisible();
  });

  test('sermon library filters by speaker', async ({ page }) => {
    await page.goto('/sermons');
    await page.getByLabel('Speaker').selectOption('elder-t-nkosi');
    await page.getByRole('button', { name: 'Find' }).click();
    await expect(page).toHaveURL(/speaker=elder-t-nkosi/);
    await expect(page.getByText('Speaker: Elder T. Nkosi')).toBeVisible();
    await expectAccessible(page);
  });
});
