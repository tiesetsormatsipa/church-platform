import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// WCAG 2.2 contrast checks for the design tokens, parsed straight from globals.css so the
// palette cannot drift below AA without failing the build.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'globals.css'), 'utf8');

function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`\\n${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

// [foreground token, background token, minimum ratio]
const TEXT_PAIRS: [string, string, number][] = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['foreground', 'surface-muted', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface-muted', 4.5],
  ['subtle-foreground', 'surface', 4.5],
  ['subtle-foreground', 'surface-muted', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['primary-soft-foreground', 'primary-soft', 4.5],
  ['link', 'surface', 4.5],
  ['link', 'background', 4.5],
  ['accent-strong', 'surface', 4.5],
  ['accent-soft-foreground', 'accent-soft', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['info', 'info-soft', 4.5],
  ['type-announcement', 'surface', 4.5],
  ['type-post', 'surface', 4.5],
  ['type-news', 'surface', 4.5],
  ['type-event', 'surface', 4.5],
  ['type-sermon', 'surface', 4.5],
  ['type-baptism', 'surface', 4.5],
  // Non-text UI: focus ring and strong borders need 3:1 against their surroundings.
  ['ring', 'background', 3],
  ['ring', 'surface', 3],
];

describe.each([
  ['light', tokens(':root')],
  ['dark', tokens('.dark')],
])('%s theme contrast', (_theme, values) => {
  it.each(TEXT_PAIRS)('%s on %s ≥ %d:1', (fg, bg, min) => {
    expect(values[fg], `missing --${fg}`).toBeDefined();
    expect(values[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(values[fg]!, values[bg]!)).toBeGreaterThanOrEqual(min);
  });
});
