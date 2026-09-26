import { expect, test } from '@playwright/test';
import { expectAccessible, userFor } from './fixtures';

test.use({ storageState: async ({}, use, testInfo) => use(userFor(testInfo).storageState) });

test('the messages page opens', async ({ page }) => {
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write to someone' })).toBeVisible();
  await expectAccessible(page);
});

test('a member writes to someone at their branch', async ({ page }, testInfo) => {
  // The mobile project signs in as the member whose membership is still pending, so there is
  // nobody they may write to; that case is the test below.
  test.skip(testInfo.project.name === 'mobile', 'covered by the pending-member test');
  test.setTimeout(90_000);

  const text = `E2E hello ${Date.now().toString(36)}`;
  await page.goto('/messages');
  await page.getByRole('button', { name: 'Write to someone' }).click();

  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: /Who would you like to write to/ }),
  ).toBeVisible();
  const firstPerson = dialog.getByRole('listitem').first().getByRole('button');
  await expect(firstPerson).toBeVisible({ timeout: 15_000 });
  const name = (await firstPerson.textContent())?.trim() ?? '';
  await firstPerson.click();

  await dialog.getByLabel('Your message').fill(text);
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();

  // The browser is sent to the thread the message landed in.
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}/);
  await expect(page.getByText(text)).toBeVisible();
  await expectAccessible(page);

  // And a reply in the same thread appears too.
  const reply = `E2E reply ${Date.now().toString(36)}`;
  await page.getByLabel('Your reply').fill(reply);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(reply)).toBeVisible();

  // Back in the list, the thread is there with the person's name on it.
  await page.getByRole('link', { name: 'All messages' }).click();
  await expect(
    page.getByRole('link', { name: new RegExp(name.split('\n')[0] ?? '') }),
  ).toBeVisible();
});

test('a member whose branch membership is still pending has nobody to write to', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'the mobile project signs in as that member');

  await page.goto('/messages');
  await page.getByRole('button', { name: 'Write to someone' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/only write to members of a branch you belong to/)).toBeVisible({
    timeout: 15_000,
  });
  await expectAccessible(page);
});
