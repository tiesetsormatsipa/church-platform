import { expect, test } from '@playwright/test';
import { expectAccessible } from './fixtures';

/**
 * The player belongs to the site, not to a page.
 *
 * The owner asked for songs and sermons to work the way the apps on his phone do, and the
 * first thing that means is that music does not stop when you go and read something else.
 * That is the behaviour these tests hold on to.
 */
test('a song keeps playing while you walk around the site', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/songs');

  const play = page.getByRole('button', { name: /^Play / }).first();
  if ((await play.count()) === 0) {
    test.skip(true, 'no song with a recording in this environment yet');
  }
  const title = (await play.getAttribute('aria-label'))?.replace(/^Play /, '') ?? '';
  await play.click();

  // The bar appears, naming what is playing.
  const bar = page.getByRole('button', { name: /^Now playing:/ });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(title.slice(0, 20));

  // Walk to another part of the site entirely.
  await page.getByRole('link', { name: 'News', exact: true }).first().click();
  await expect(page).toHaveURL(/\/news$/);

  // Still there, still the same recording: the <audio> element was never unmounted.
  await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText(
    title.slice(0, 20),
  );
});

test('the bar can be closed and takes itself off the screen', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/songs');
  const play = page.getByRole('button', { name: /^Play / }).first();
  if ((await play.count()) === 0) test.skip(true, 'no song with a recording yet');
  await play.click();
  await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();

  // Desktop only: on a phone the close button lives on the full-screen player.
  const close = page.getByRole('button', { name: 'Close the player' });
  if (await close.isVisible()) {
    await close.click();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toHaveCount(0);
  }
});

test('the songs page is still sound with the player on it', async ({ page }) => {
  await page.goto('/songs');
  await expect(page.getByRole('heading', { name: 'Songs', level: 1 })).toBeVisible();
  await expectAccessible(page);
});
