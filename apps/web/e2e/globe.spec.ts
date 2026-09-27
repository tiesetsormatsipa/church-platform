import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './fixtures';

/**
 * The globe lives on the branch directory. These tests drive the canvas the way a finger
 * does, because the one thing that broke in the wild — the canvas not repainting while the
 * globe was dragged — looked perfectly correct in the source and could only be caught by
 * turning it and seeing that nothing changed.
 */

/** A hash of what is actually painted, cheap enough to run twice in a test. */
async function canvasFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('The globe has not drawn yet');
    const data = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data.charCodeAt(i)) | 0;
    return String(hash);
  });
}

test('the globe is on the branch directory', async ({ page }) => {
  await page.goto('/branches');
  await expect(page.getByRole('heading', { name: 'Explore the church' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Branch directory' })).toBeVisible();
  // The canvas is decorative; everything on it is reachable as real controls beside it.
  await expect(page.getByRole('button', { name: /Johannesburg/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expectAccessible(page);
});

test('the old address for the globe still leads somewhere', async ({ page }) => {
  await page.goto('/globe');
  await expect(page).toHaveURL(/\/branches$/);
});

test('dragging the globe turns it', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/branches');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  // Wait for the coastlines, so the first frame is not still being drawn.
  await expect.poll(async () => canvasFingerprint(page), { timeout: 20_000 }).not.toBe('0');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = await canvasFingerprint(page);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(box!.x + box!.width / 2 + step * 18, box!.y + box!.height / 2);
  }
  await page.mouse.up();

  await expect.poll(async () => canvasFingerprint(page)).not.toBe(before);
});

test('tapping a place on the globe shows who is there', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/branches');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  // Fly to a branch first, which puts its dot in the middle of the disc.
  await page
    .getByRole('button', { name: /Johannesburg/ })
    .first()
    .click();
  await page.waitForTimeout(1500);

  const box = await canvas.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  // A tap with a couple of pixels of wobble must still count as a tap, not a drag.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 2, y + 1);
  await page.mouse.up();

  await expect(page.getByText('Who to speak to')).toBeVisible();
});
