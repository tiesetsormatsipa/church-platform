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

test('the globe can be brought closer', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/branches');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => canvasFingerprint(page), { timeout: 20_000 }).not.toBe('0');

  // The buttons matter on their own account: not every visitor has a wheel or two fingers.
  const before = await canvasFingerprint(page);
  await page.getByRole('button', { name: 'Come closer' }).click();
  await expect.poll(async () => canvasFingerprint(page)).not.toBe(before);

  const closer = await canvasFingerprint(page);
  await page.getByRole('button', { name: 'Move away' }).click();
  await expect.poll(async () => canvasFingerprint(page)).not.toBe(closer);
});

test('two fingers pinch the globe closer', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/branches');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => canvasFingerprint(page), { timeout: 20_000 }).not.toBe('0');

  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const before = await canvasFingerprint(page);

  // Playwright's mouse cannot pinch, so the two touches are dispatched directly. This is the
  // gesture a phone sends, and it was the one the globe did not listen for at all.
  await page.evaluate(
    ({ cx, cy }) => {
      const el = document.querySelector('canvas')!;
      el.setPointerCapture = () => {};
      const opts = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(
        new PointerEvent('pointerdown', { ...opts, pointerId: 11, clientX: cx - 40, clientY: cy }),
      );
      el.dispatchEvent(
        new PointerEvent('pointerdown', { ...opts, pointerId: 12, clientX: cx + 40, clientY: cy }),
      );
      for (let step = 1; step <= 5; step += 1) {
        const spread = 40 + step * 20;
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            ...opts,
            pointerId: 11,
            clientX: cx - spread,
            clientY: cy,
          }),
        );
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            ...opts,
            pointerId: 12,
            clientX: cx + spread,
            clientY: cy,
          }),
        );
      }
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 11 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 12 }));
    },
    { cx, cy },
  );

  await expect.poll(async () => canvasFingerprint(page)).not.toBe(before);
});

test('tapping a dot shows the branch right there, with a way to read more', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/branches');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  await page
    .getByRole('button', { name: /Johannesburg/ })
    .first()
    .click();
  await page.waitForTimeout(1500);

  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();

  // The card sits over the globe, not somewhere down the page.
  const card = page.locator('canvas ~ div').filter({ hasText: 'Read more' }).first();
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  expect(cardBox.y).toBeLessThan(box.y + box.height + 40);

  await expect(card.getByText('Saints')).toBeVisible();
  await expect(card.getByText('Baptised')).toBeVisible();
  // Located by href rather than by role: the card sits on the decorative canvas and is
  // aria-hidden, because the list beside the globe already offers every branch properly.
  await expect(card.locator('a[href="/branches/johannesburg"]')).toBeVisible();
});
