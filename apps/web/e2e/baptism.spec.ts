import { expect, test } from '@playwright/test';
import { expectAccessible } from './fixtures';

test.describe('baptism enquiry', () => {
  test('explains what is missing', async ({ page }) => {
    await page.goto('/baptism');
    await expect(page.getByRole('button', { name: 'Send request' })).toBeEnabled();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('This field is required').first()).toBeVisible();
    await expect(page.getByText('Please agree so that the branch can contact you')).toBeVisible();
    await expectAccessible(page);
  });

  test('confirms a sent request', async ({ page }) => {
    // The real endpoint is covered by API integration tests; stub it so runs stay repeatable
    // (it is rate-limited per IP).
    await page.route('**/api/v1/baptism-requests', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'accepted', message: 'Thank you. Someone from the Durban branch will contact you soon.' }),
      }),
    );
    await page.goto('/baptism');
    await expect(page.getByRole('button', { name: 'Send request' })).toBeEnabled();
    await page.getByLabel('Branch', { exact: true }).selectOption('durban');
    await page.getByLabel('Full name').fill('Test Visitor');
    await page.getByLabel('E-mail address').fill('visitor@example.org');
    await page.getByLabel(/I agree/).check();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByRole('heading', { name: /Your request has been sent/ })).toBeFocused();
    await expect(page.getByText('Someone from the Durban branch will contact you soon.')).toBeVisible();
  });
});
