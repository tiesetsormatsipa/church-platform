import { describe, expect, it } from 'vitest';
import {
  clampPhi,
  dotRadius,
  interpolateView,
  isVisible,
  rotationFor,
  shortestAngle,
  shouldLabel,
} from './projection';

describe('isVisible', () => {
  it('shows a point at the centre of the disc', () => {
    // Johannesburg centred: it must be visible.
    const rotation = rotationFor(28.05, -26.2);
    expect(isVisible(28.05, -26.2, rotation)).toBe(true);
  });

  it('hides the point directly opposite, on the far side of the Earth', () => {
    const rotation = rotationFor(28.05, -26.2);
    expect(isVisible(28.05 - 180, 26.2, rotation)).toBe(false);
  });

  it('hides a point just past the rim', () => {
    const rotation = rotationFor(0, 0);
    expect(isVisible(89, 0, rotation)).toBe(true);
    expect(isVisible(91, 0, rotation)).toBe(false);
  });

  it('respects a stricter threshold', () => {
    const rotation = rotationFor(0, 0);
    // 80° away is visible normally, but not once the rim is trimmed.
    expect(isVisible(80, 0, rotation)).toBe(true);
    expect(isVisible(80, 0, rotation, 0.3)).toBe(false);
  });
});

describe('shortestAngle', () => {
  it('goes the short way round the meridian', () => {
    expect(shortestAngle(170, -170)).toBe(20);
    expect(shortestAngle(-170, 170)).toBe(-20);
  });

  it('is zero for the same angle', () => {
    expect(shortestAngle(45, 45)).toBe(0);
  });

  it('handles a plain forward step', () => {
    expect(shortestAngle(10, 40)).toBe(30);
  });
});

describe('rotationFor', () => {
  it('negates the coordinates, which is what the projection expects', () => {
    expect(rotationFor(28, -26)).toEqual({ lambda: -28, phi: 26 });
  });
});

describe('interpolateView', () => {
  const from = { rotation: { lambda: 0, phi: 0 }, scale: 100 };
  const to = { rotation: { lambda: 60, phi: 30 }, scale: 300 };

  it('starts at the beginning and ends at the end', () => {
    expect(interpolateView(from, to, 0)).toEqual(from);
    const end = interpolateView(from, to, 1);
    expect(end.rotation.lambda).toBeCloseTo(60);
    expect(end.rotation.phi).toBeCloseTo(30);
    expect(end.scale).toBeCloseTo(300);
  });

  it('moves monotonically towards the target', () => {
    const quarter = interpolateView(from, to, 0.25);
    const half = interpolateView(from, to, 0.5);
    expect(quarter.scale).toBeLessThan(half.scale);
    expect(half.scale).toBeLessThan(300);
  });

  it('crosses the meridian the short way', () => {
    const wrap = interpolateView(
      { rotation: { lambda: 170, phi: 0 }, scale: 100 },
      { rotation: { lambda: -170, phi: 0 }, scale: 100 },
      0.5,
    );
    // The short way passes through 180, not back through zero.
    expect(Math.abs(wrap.rotation.lambda)).toBeGreaterThan(170);
  });
});

describe('clampPhi', () => {
  it('stops the globe tipping past the poles', () => {
    expect(clampPhi(120)).toBe(90);
    expect(clampPhi(-120)).toBe(-90);
    expect(clampPhi(45)).toBe(45);
  });
});

describe('dotRadius', () => {
  it('draws a main branch larger than a sub-branch', () => {
    expect(dotRadius('MAIN', 300, 300)).toBeGreaterThan(dotRadius('SUB', 300, 300));
  });

  it('grows with zoom but stays within bounds', () => {
    const near = dotRadius('MAIN', 1200, 300);
    const far = dotRadius('MAIN', 300, 300);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThanOrEqual(6 * 2.2);
    expect(dotRadius('SUB', 1, 300)).toBeGreaterThanOrEqual(2.5);
  });
});

describe('shouldLabel', () => {
  it('keeps the globe clean until it is zoomed in', () => {
    expect(shouldLabel(300, 300, 'MAIN')).toBe(false);
    expect(shouldLabel(300, 300, 'SUB')).toBe(false);
  });

  it('names the main branches before the sub-branches', () => {
    expect(shouldLabel(450, 300, 'MAIN')).toBe(true);
    expect(shouldLabel(450, 300, 'SUB')).toBe(false);
    expect(shouldLabel(700, 300, 'SUB')).toBe(true);
  });
});
