/**
 * Geometry helpers for the globe, kept out of the component so they can be tested.
 *
 * The globe is an orthographic projection: the Earth as seen from far away, so only the
 * near hemisphere is visible and a point must be hidden when it rotates round the back.
 */

export interface Rotation {
  /** Degrees of longitude at the centre, negated (d3's convention). */
  lambda: number;
  /** Degrees of latitude at the centre, negated. */
  phi: number;
}

const DEG = Math.PI / 180;

/**
 * Is this point on the visible half of the globe?
 *
 * The angular distance from the centre of the disc must be under 90°; anything beyond that
 * is round the far side and must not be drawn, or dots show through the Earth.
 */
export function isVisible(
  longitude: number,
  latitude: number,
  rotation: Rotation,
  /** Cosine of the cut-off; slightly above 0 hides points exactly on the rim. */
  threshold = 0,
): boolean {
  const centreLon = -rotation.lambda * DEG;
  const centreLat = -rotation.phi * DEG;
  const lon = longitude * DEG;
  const lat = latitude * DEG;
  const cosine =
    Math.sin(centreLat) * Math.sin(lat) +
    Math.cos(centreLat) * Math.cos(lat) * Math.cos(lon - centreLon);
  return cosine > threshold;
}

/** The shortest signed difference between two angles, in degrees (−180, 180]. */
export function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}

/** The rotation that brings a point to the centre of the disc. */
export function rotationFor(longitude: number, latitude: number): Rotation {
  return { lambda: -longitude, phi: -latitude };
}

/** Eased interpolation between two rotations and scales, for the fly-to animation. */
export function interpolateView(
  from: { rotation: Rotation; scale: number },
  to: { rotation: Rotation; scale: number },
  t: number,
): { rotation: Rotation; scale: number } {
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return {
    rotation: {
      lambda:
        from.rotation.lambda + shortestAngle(from.rotation.lambda, to.rotation.lambda) * eased,
      phi: from.rotation.phi + (to.rotation.phi - from.rotation.phi) * eased,
    },
    scale: from.scale + (to.scale - from.scale) * eased,
  };
}

/** Clamp a latitude so dragging cannot tip the globe past the poles. */
export function clampPhi(phi: number): number {
  return Math.max(-90, Math.min(90, phi));
}

/**
 * How big to draw a branch's dot. Main branches read larger than the sub-branches beneath
 * them, and everything grows a little as the globe is zoomed in.
 */
export function dotRadius(type: string, scale: number, baseScale: number): number {
  const zoom = Math.sqrt(scale / baseScale);
  const base = type === 'MAIN' ? 6 : 3.5;
  return Math.max(2.5, Math.min(base * zoom, base * 2.2));
}

/** Labels would be unreadable clutter until the globe is zoomed in past this point. */
export function shouldLabel(scale: number, baseScale: number, type: string): boolean {
  const zoom = scale / baseScale;
  return type === 'MAIN' ? zoom > 1.25 : zoom > 2;
}
