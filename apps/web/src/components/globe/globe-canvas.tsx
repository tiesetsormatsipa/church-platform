'use client';

import type { GeoBranch, GeoCountry } from '@church/shared';
import { geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import * as React from 'react';
import { feature } from 'topojson-client';
import {
  clampPhi,
  dotRadius,
  interpolateView,
  isVisible,
  rotationFor,
  shouldLabel,
  type Rotation,
} from './projection';

interface Props {
  countries: GeoCountry[];
  branches: GeoBranch[];
  selected: GeoBranch | null;
  onSelect: (branch: GeoBranch | null) => void;
  /** Set when the viewer picks a country or searches, to fly the camera there. */
  focus: { longitude: number; latitude: number; zoom: number } | null;
}

/**
 * The slice of TopoJSON this file touches. `topojson-specification` is a types-only package
 * we would otherwise add just for two field names.
 */
interface WorldTopology {
  objects: Record<string, unknown>;
}

interface LandFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoPermissibleObjects;
}

const FLIGHT_MS = 900;

/**
 * The church on an orthographic globe.
 *
 * Drawn on a canvas because a few thousand land paths redrawn on every drag frame is more
 * than the DOM should be asked to do. The canvas is decorative as far as assistive
 * technology is concerned: the same countries and branches are rendered as real, focusable
 * buttons beside it (see `GlobeExplorer`), so nothing here is the only way to reach them.
 */
export function GlobeCanvas({ countries, branches, selected, onSelect, focus }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [land, setLand] = React.useState<LandFeature[] | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  // The camera. Kept in a ref because it changes on every animation frame.
  const view = React.useRef({ rotation: { lambda: -20, phi: -10 } as Rotation, scale: 0 });
  const baseScale = React.useRef(0);
  const flight = React.useRef<{
    start: number;
    from: typeof view.current;
    to: typeof view.current;
  } | null>(null);
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const [, forceDraw] = React.useReducer((n: number) => n + 1, 0);

  const hues = React.useMemo(() => new Map(countries.map((c) => [c.code, c.hue])), [countries]);
  const withPlace = React.useMemo(
    () => branches.filter((b) => b.latitude !== null && b.longitude !== null),
    [branches],
  );

  // --- the world -------------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    void import('world-atlas/countries-110m.json')
      .then((module) => {
        const topology = (module.default ?? module) as unknown as WorldTopology;
        const collection = feature(
          topology as never,
          topology.objects.countries as never,
        ) as unknown as {
          features: LandFeature[];
        };
        if (!cancelled) setLand(collection.features);
      })
      .catch(() => {
        // The globe still works without coastlines: the branches are what matter.
        if (!cancelled) setLand([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- size ------------------------------------------------------------------------------
  React.useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (!box) return;
      const width = box.width;
      const height = Math.max(320, Math.min(box.width, 560));
      setSize({ width, height });
      const next = Math.min(width, height) / 2 - 8;
      if (baseScale.current === 0) {
        baseScale.current = next;
        view.current.scale = next;
      } else {
        const ratio = view.current.scale / baseScale.current;
        baseScale.current = next;
        view.current.scale = next * ratio;
      }
      forceDraw();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // --- fly to a place --------------------------------------------------------------------
  React.useEffect(() => {
    if (!focus || baseScale.current === 0) return;
    flight.current = {
      start: performance.now(),
      from: { rotation: { ...view.current.rotation }, scale: view.current.scale },
      to: {
        rotation: rotationFor(focus.longitude, focus.latitude),
        scale: baseScale.current * focus.zoom,
      },
    };
    forceDraw();
  }, [focus]);

  // --- drawing ---------------------------------------------------------------------------
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || baseScale.current === 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    const styles = getComputedStyle(canvas);
    const ocean = styles.getPropertyValue('--globe-ocean').trim() || '#0b1220';
    const landFill = styles.getPropertyValue('--globe-land').trim() || '#1e293b';
    const landLine = styles.getPropertyValue('--globe-land-line').trim() || '#334155';
    const labelColour = styles.getPropertyValue('--globe-label').trim() || '#e2e8f0';

    const render = () => {
      const now = performance.now();
      if (flight.current) {
        const t = Math.min(1, (now - flight.current.start) / FLIGHT_MS);
        const stepped = interpolateView(flight.current.from, flight.current.to, t);
        view.current.rotation = stepped.rotation;
        view.current.scale = stepped.scale;
        if (t >= 1) flight.current = null;
      }

      const ratio = window.devicePixelRatio || 1;
      canvas.width = size.width * ratio;
      canvas.height = size.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);

      const projection = geoOrthographic()
        .scale(view.current.scale)
        .translate([size.width / 2, size.height / 2])
        .rotate([view.current.rotation.lambda, view.current.rotation.phi, 0])
        .clipAngle(90);
      const path = geoPath(projection, context);

      // The sphere itself.
      context.beginPath();
      path({ type: 'Sphere' });
      context.fillStyle = ocean;
      context.fill();

      // Land, with the church's countries picked out in their own colour.
      if (land) {
        for (const shape of land) {
          const code = numericToAlpha2(shape.id);
          const hue = code ? hues.get(code) : undefined;
          context.beginPath();
          path(shape.geometry);
          context.fillStyle = hue === undefined ? landFill : `hsl(${hue} 55% 32%)`;
          context.fill();
          context.strokeStyle = landLine;
          context.lineWidth = 0.4;
          context.stroke();
        }
      }

      // Branch dots, sub-branches first so a main branch is never hidden behind one.
      const order = [...withPlace].sort(
        (a, b) => (a.type === 'MAIN' ? 1 : 0) - (b.type === 'MAIN' ? 1 : 0),
      );
      for (const branch of order) {
        const lon = branch.longitude!;
        const lat = branch.latitude!;
        if (!isVisible(lon, lat, view.current.rotation)) continue;
        const point = projection([lon, lat]);
        if (!point) continue;
        const [x, y] = point;
        const hue = hues.get(branch.countryCode) ?? 210;
        const radius = dotRadius(branch.type, view.current.scale, baseScale.current);
        const isSelected = selected?.id === branch.id;

        if (isSelected) {
          context.beginPath();
          context.arc(x, y, radius + 5, 0, Math.PI * 2);
          context.strokeStyle = `hsl(${hue} 90% 70%)`;
          context.lineWidth = 2;
          context.stroke();
        }
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `hsl(${hue} 85% 60%)`;
        context.fill();
        context.strokeStyle = 'rgba(0,0,0,0.55)';
        context.lineWidth = 1;
        context.stroke();

        if (isSelected || shouldLabel(view.current.scale, baseScale.current, branch.type)) {
          context.font =
            '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'bottom';
          const label = branch.name;
          const width = context.measureText(label).width;
          context.fillStyle = 'rgba(0,0,0,0.6)';
          context.fillRect(x - width / 2 - 4, y - radius - 20, width + 8, 16);
          context.fillStyle = labelColour;
          context.fillText(label, x, y - radius - 6);
        }
      }

      if (flight.current) frame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frame);
  }, [land, size, hues, withPlace, selected, focus]);

  // --- interaction -----------------------------------------------------------------------
  function branchAt(clientX: number, clientY: number): GeoBranch | null {
    const canvas = canvasRef.current;
    if (!canvas || baseScale.current === 0) return null;
    const box = canvas.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    const projection = geoOrthographic()
      .scale(view.current.scale)
      .translate([size.width / 2, size.height / 2])
      .rotate([view.current.rotation.lambda, view.current.rotation.phi, 0])
      .clipAngle(90);
    let best: { branch: GeoBranch; distance: number } | null = null;
    for (const branch of withPlace) {
      if (!isVisible(branch.longitude!, branch.latitude!, view.current.rotation)) continue;
      const point = projection([branch.longitude!, branch.latitude!]);
      if (!point) continue;
      const distance = Math.hypot(point[0] - x, point[1] - y);
      const radius = dotRadius(branch.type, view.current.scale, baseScale.current) + 8;
      if (distance <= radius && (!best || distance < best.distance)) best = { branch, distance };
    }
    return best?.branch ?? null;
  }

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ width: size.width, height: size.height, touchAction: 'none', cursor: 'grab' }}
        onPointerDown={(e) => {
          flight.current = null;
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.style.cursor = 'grabbing';
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          const speed = 180 / view.current.scale;
          view.current.rotation = {
            lambda: view.current.rotation.lambda + dx * speed,
            phi: clampPhi(view.current.rotation.phi - dy * speed),
          };
          forceDraw();
        }}
        onPointerUp={(e) => {
          const moved = drag.current === null;
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
          if (!moved) {
            const hit = branchAt(e.clientX, e.clientY);
            if (hit) onSelect(hit);
          }
        }}
        onWheel={(e) => {
          const next = view.current.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
          view.current.scale = Math.max(
            baseScale.current * 0.8,
            Math.min(next, baseScale.current * 6),
          );
          forceDraw();
        }}
      />
      {land === null ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Drawing the world…
        </p>
      ) : null}
    </div>
  );
}

/**
 * world-atlas identifies countries by UN M49 number; the church's data uses ISO alpha-2.
 * Only the countries the church is in need translating, so this is a small table rather
 * than the whole of ISO 3166.
 */
const M49_TO_ALPHA2: Record<string, string> = {
  '710': 'ZA',
  '516': 'NA',
  '072': 'BW',
  '716': 'ZW',
  '508': 'MZ',
  '426': 'LS',
  '748': 'SZ',
  '894': 'ZM',
  '454': 'MW',
  '404': 'KE',
  '566': 'NG',
  '288': 'GH',
  '840': 'US',
  '826': 'GB',
  '124': 'CA',
  '036': 'AU',
  '356': 'IN',
  '388': 'JM',
};

function numericToAlpha2(id: string | number | undefined): string | undefined {
  if (id === undefined) return undefined;
  return M49_TO_ALPHA2[String(id).padStart(3, '0')];
}
