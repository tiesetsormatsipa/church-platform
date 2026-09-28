'use client';

import type { GeoBranch, GeoCountry } from '@church/shared';
import { geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { feature } from 'topojson-client';
import {
  clampPhi,
  clampScale,
  dotRadius,
  interpolateView,
  isVisible,
  pinchDistance,
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

/** Movement under this many pixels is a tap, not a drag. */
const DRAG_SLOP = 4;

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
  /** Every pointer currently down, by id: one turns the globe, two pinch it. */
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const drag = React.useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = React.useRef<{ distance: number; scale: number } | null>(null);
  /** Where the selected branch sits on screen, so its card can follow the dot. */
  const [pin, setPin] = React.useState<{ x: number; y: number } | null>(null);
  /**
   * Repaint on demand.
   *
   * The camera lives in a ref and changes on every pointer move, so React does not know it
   * changed. The drawing effect publishes its render function here and the handlers call it
   * straight away; making the effect itself depend on a counter would tear the canvas down
   * and re-read the computed styles on every frame of a drag.
   */
  const drawRef = React.useRef<(() => void) | null>(null);
  const forceDraw = React.useCallback(() => drawRef.current?.(), []);

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
  }, [forceDraw]);

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
  }, [focus, forceDraw]);

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
      // Where the selected dot ended up this frame; null when it is round the back.
      let selectedAt: { x: number; y: number } | null = null;
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
          selectedAt = { x, y };
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

      // Only a real change, so a card sitting still does not re-render every frame.
      setPin((current) => {
        if (!selectedAt) return current === null ? current : null;
        if (
          current &&
          Math.abs(current.x - selectedAt.x) < 1 &&
          Math.abs(current.y - selectedAt.y) < 1
        ) {
          return current;
        }
        return selectedAt;
      });

      if (flight.current) frame = requestAnimationFrame(render);
    };

    drawRef.current = render;
    render();
    return () => {
      cancelAnimationFrame(frame);
      drawRef.current = null;
    };
  }, [land, size, hues, withPlace, selected, focus]);

  // --- interaction -----------------------------------------------------------------------
  function zoomBy(factor: number) {
    flight.current = null;
    view.current.scale = clampScale(view.current.scale * factor, baseScale.current);
    forceDraw();
  }

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
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          e.currentTarget.setPointerCapture(e.pointerId);
          if (pointers.current.size === 2) {
            // A second finger starts a pinch and ends whatever drag was under way.
            const [a, b] = [...pointers.current.values()];
            pinch.current = { distance: pinchDistance(a!, b!), scale: view.current.scale };
            drag.current = null;
          } else {
            drag.current = { x: e.clientX, y: e.clientY, moved: false };
            e.currentTarget.style.cursor = 'grabbing';
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pinch.current && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const spread = pinchDistance(a!, b!);
            if (pinch.current.distance > 0) {
              view.current.scale = clampScale(
                (pinch.current.scale * spread) / pinch.current.distance,
                baseScale.current,
              );
              forceDraw();
            }
            return;
          }

          const from = drag.current;
          if (!from) return;
          const dx = e.clientX - from.x;
          const dy = e.clientY - from.y;
          // A few pixels of wobble is a tap on a phone, not a drag, so it must still select.
          const moved = from.moved || Math.hypot(dx, dy) > DRAG_SLOP;
          drag.current = { x: e.clientX, y: e.clientY, moved };
          const speed = 180 / view.current.scale;
          view.current.rotation = {
            lambda: view.current.rotation.lambda + dx * speed,
            phi: clampPhi(view.current.rotation.phi - dy * speed),
          };
          forceDraw();
        }}
        onPointerUp={(e) => {
          const wasPinching = pinch.current !== null;
          const moved = drag.current?.moved ?? false;
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
          // Lifting one finger of a pinch is not a tap on whatever is underneath.
          if (!moved && !wasPinching) {
            const hit = branchAt(e.clientX, e.clientY);
            onSelect(hit);
          }
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          drag.current = null;
          e.currentTarget.style.cursor = 'grab';
        }}
        onWheel={(e) => {
          view.current.scale = clampScale(
            view.current.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
            baseScale.current,
          );
          forceDraw();
        }}
      />
      {/* Closer and further, for anyone without a wheel or a second finger. */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(1.35)}
          className="flex size-9 items-center justify-center rounded-lg border border-white/25 bg-black/45 text-lg font-semibold text-white backdrop-blur hover:bg-black/65"
        >
          <span aria-hidden="true">+</span>
          <span className="sr-only">Come closer</span>
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.35)}
          className="flex size-9 items-center justify-center rounded-lg border border-white/25 bg-black/45 text-lg font-semibold text-white backdrop-blur hover:bg-black/65"
        >
          <span aria-hidden="true">−</span>
          <span className="sr-only">Move away</span>
        </button>
      </div>

      {selected && pin ? (
        <BranchCard branch={selected} at={pin} bounds={size} onClose={() => onSelect(null)} />
      ) : null}

      {land === null ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Drawing the world…
        </p>
      ) : null}
    </div>
  );
}

/**
 * The short version, pinned to the dot that was pressed.
 *
 * The owner asked for this: having to scroll down the page to read who is at a place you
 * have just tapped, then scroll back to the globe, makes exploring tiresome. Everything
 * worth knowing at a glance is here, and "Read more" goes to the branch's own page.
 *
 * It is `aria-hidden` because the canvas is: the same branch is a real, focusable button in
 * the list beside the globe, and this would only repeat it for a screen reader.
 */
function BranchCard({
  branch,
  at,
  bounds,
  onClose,
}: {
  branch: GeoBranch;
  at: { x: number; y: number };
  bounds: { width: number; height: number };
  onClose: () => void;
}) {
  const WIDTH = 232;
  // Keep it on the canvas, and above the dot unless there is no room up there.
  const left = Math.max(8, Math.min(at.x - WIDTH / 2, bounds.width - WIDTH - 8));
  const above = at.y > 150;
  const style: React.CSSProperties = above
    ? { left, bottom: bounds.height - at.y + 16, width: WIDTH }
    : { left, top: at.y + 16, width: WIDTH };

  return (
    <div
      aria-hidden="true"
      style={style}
      className="absolute z-10 rounded-xl border border-white/20 bg-black/80 p-3 text-white shadow-overlay backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{branch.name}</p>
        <button
          type="button"
          onClick={onClose}
          tabIndex={-1}
          className="-mt-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/15 hover:text-white"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {branch.city ? <p className="text-xs text-white/70">{branch.city}</p> : null}
      <dl className="mt-2 flex gap-4 text-xs">
        <div>
          <dt className="text-white/60">Saints</dt>
          <dd className="font-semibold">{branch.members}</dd>
        </div>
        <div>
          <dt className="text-white/60">Baptised</dt>
          <dd className="font-semibold">{branch.baptisms.total}</dd>
        </div>
      </dl>
      {branch.leaders[0] ? (
        <p className="mt-2 truncate text-xs text-white/80">
          {branch.leaders[0].title}: {branch.leaders[0].name}
        </p>
      ) : null}
      <Link
        href={`/branches/${branch.slug}`}
        tabIndex={-1}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white underline underline-offset-2"
      >
        Read more
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Link>
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
