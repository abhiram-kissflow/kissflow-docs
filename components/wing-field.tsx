'use client';

import { type CSSProperties, useEffect, useRef } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Size tiers → responsive clamp widths.
const SIZE: Record<string, string> = {
  sm: 'clamp(3rem, 6vw, 4.75rem)',
  md: 'clamp(5.5rem, 11vw, 9rem)',
  lg: 'clamp(8rem, 15.5vw, 13rem)',
  xl: 'clamp(23rem, 55vw, 45rem)',
};

type Layer = 'far' | 'mid' | 'near';

interface GlassObject {
  img: string;
  layer: Layer;
  pos: { left?: string; right?: string; top: string };
  size: keyof typeof SIZE;
  rot: number;
  op: number;
  blur: number;
}

// Initial placement — concentrated in the first fold, in the side gutters around
// the centered headline + ask box. Physics takes over from here for the crystals.
const OBJECTS: GlassObject[] = [
  // Near — big, out-of-focus foreground blooms. Atmosphere, not physics bodies.
  { img: 'foreground', layer: 'near', pos: { left: '-8%', top: '24%' }, size: 'xl', rot: -6, op: 0.5, blur: 22 },
  { img: 'foreground', layer: 'near', pos: { right: '-12%', top: '-18%' }, size: 'xl', rot: 152, op: 0.42, blur: 28 },
  // Mid — the sharp hero crystals.
  { img: 'pebble', layer: 'mid', pos: { left: '4%', top: '18%' }, size: 'lg', rot: -8, op: 0.95, blur: 0 },
  { img: 'cluster', layer: 'mid', pos: { left: '3%', top: '44%' }, size: 'md', rot: 4, op: 0.95, blur: 0 },
  { img: 'drop', layer: 'mid', pos: { left: '9%', top: '62%' }, size: 'md', rot: 0, op: 0.9, blur: 0 },
  { img: 'shard', layer: 'mid', pos: { right: '3%', top: '12%' }, size: 'lg', rot: 8, op: 0.95, blur: 0 },
  { img: 'lens', layer: 'mid', pos: { right: '4%', top: '42%' }, size: 'lg', rot: -6, op: 0.9, blur: 0 },
  { img: 'ribbon', layer: 'mid', pos: { right: '8%', top: '64%' }, size: 'lg', rot: 0, op: 0.9, blur: 0 },
  // Far — small, faint, softened crystals; also physics bodies.
  { img: 'pebble', layer: 'far', pos: { left: '19%', top: '9%' }, size: 'sm', rot: 12, op: 0.5, blur: 2 },
  { img: 'shard', layer: 'far', pos: { right: '15%', top: '34%' }, size: 'sm', rot: -10, op: 0.5, blur: 2 },
  { img: 'drop', layer: 'far', pos: { left: '14%', top: '30%' }, size: 'sm', rot: 0, op: 0.5, blur: 2 },
  { img: 'lens', layer: 'far', pos: { left: '52%', top: '3%' }, size: 'sm', rot: 0, op: 0.45, blur: 2 },
  { img: 'cluster', layer: 'far', pos: { right: '20%', top: '58%' }, size: 'sm', rot: 0, op: 0.5, blur: 2 },
];

const BLOOMS = OBJECTS.filter((o) => o.layer === 'near');
const BODIES = OBJECTS.filter((o) => o.layer !== 'near');

// Physics tuning.
const BASE_SPEED = 20; // px/s idle drift
const MAX_SPEED = 90;
const REPEL_R = 150; // cursor push radius (px)
const REPEL_F = 900; // cursor push strength
const KEEPOUT = { x0: 0.24, y0: 0.06, x1: 0.76, y1: 0.6 }; // content zone (fractions)

interface Body {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  spinV: number;
  active: boolean;
}

/**
 * "Glass Collider" — photoreal frosted/liquid-glass crystals floating in the
 * first fold as physics bodies: they drift, collide, and elastically deflect off
 * each other, the viewport walls, the cursor, and an invisible keep-out box
 * around the headline + ask box (so they never cover the reading area). Big
 * out-of-focus glass blooms sit behind as static atmosphere. Works on light and
 * dark (self-lit transparent assets). aria-hidden, pointer-events-none, static
 * under prefers-reduced-motion.
 */
export function WingField() {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyEls = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    let H = 0;

    const bodies: Body[] = BODIES.map((o, i) => {
      const el = bodyEls.current[i]!;
      return { el, x: 0, y: 0, vx: 0, vy: 0, r: 0, spin: o.rot, spinV: (i % 2 ? 1 : -1) * (4 + (i % 3) * 3), active: true };
    });

    // Deterministic-ish seeded angle per body (no Math.random at module scope needed).
    const seededAngle = (i: number) => (i * 2.399963) % (Math.PI * 2);

    const place = () => {
      W = root.clientWidth;
      H = Math.min(root.clientHeight, window.innerHeight * 0.94);
      bodies.forEach((b, i) => {
        const o = BODIES[i];
        b.active = b.el.offsetWidth > 0; // hidden (mobile) far crystals sit out
        b.r = (b.el.offsetWidth || 80) * 0.4;
        const leftPct = o.pos.left != null ? parseFloat(o.pos.left) : 100 - parseFloat(o.pos.right!);
        b.x = (leftPct / 100) * W;
        b.y = (parseFloat(o.pos.top) / 100) * H;
        const a = seededAngle(i);
        b.vx = Math.cos(a) * BASE_SPEED;
        b.vy = Math.sin(a) * BASE_SPEED;
      });
    };
    place();
    window.addEventListener('resize', place);

    const render = (b: Body) => {
      b.el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) rotate(${b.spin}deg)`;
    };

    if (reduce) {
      bodies.forEach(render);
      return () => window.removeEventListener('resize', place);
    }

    let cursor: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => (cursor = null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerout', onLeave);

    const clampSpeed = (b: Body) => {
      const s = Math.hypot(b.vx, b.vy);
      if (s > MAX_SPEED) {
        b.vx = (b.vx / s) * MAX_SPEED;
        b.vy = (b.vy / s) * MAX_SPEED;
      } else if (s < BASE_SPEED * 0.4) {
        const a = Math.atan2(b.vy || 1, b.vx || 1);
        b.vx = Math.cos(a) * BASE_SPEED * 0.6;
        b.vy = Math.sin(a) * BASE_SPEED * 0.6;
      }
    };

    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const kx0 = KEEPOUT.x0 * W;
      const ky0 = KEEPOUT.y0 * H;
      const kx1 = KEEPOUT.x1 * W;
      const ky1 = KEEPOUT.y1 * H;

      for (const b of bodies) {
        if (!b.active) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.spin += b.spinV * dt;

        // Walls (elastic).
        if (b.x < b.r) (b.x = b.r), (b.vx = Math.abs(b.vx));
        else if (b.x > W - b.r) (b.x = W - b.r), (b.vx = -Math.abs(b.vx));
        if (b.y < b.r) (b.y = b.r), (b.vy = Math.abs(b.vy));
        else if (b.y > H - b.r) (b.y = H - b.r), (b.vy = -Math.abs(b.vy));

        // Keep-out box around the headline + ask box: deflect off its nearest edge.
        if (b.x + b.r > kx0 && b.x - b.r < kx1 && b.y + b.r > ky0 && b.y - b.r < ky1) {
          const dl = b.x + b.r - kx0; // push left
          const dr = kx1 - (b.x - b.r); // push right
          const dtp = b.y + b.r - ky0; // push up
          const db = ky1 - (b.y - b.r); // push down
          const m = Math.min(dl, dr, dtp, db);
          if (m === dl) (b.x = kx0 - b.r), (b.vx = -Math.abs(b.vx));
          else if (m === dr) (b.x = kx1 + b.r), (b.vx = Math.abs(b.vx));
          else if (m === dtp) (b.y = ky0 - b.r), (b.vy = -Math.abs(b.vy));
          else (b.y = ky1 + b.r), (b.vy = Math.abs(b.vy));
        }

        // Cursor repel.
        if (cursor) {
          const dx = b.x - cursor.x;
          const dy = b.y - cursor.y;
          const d = Math.hypot(dx, dy);
          if (d < REPEL_R && d > 0.01) {
            const f = (REPEL_F * (1 - d / REPEL_R)) / d;
            b.vx += dx * f * dt;
            b.vy += dy * f * dt;
          }
        }
      }

      // Pairwise collisions (equal-mass elastic).
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const c = bodies[j];
          if (!a.active || !c.active) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const min = a.r + c.r;
          if (dist < min) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (min - dist) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            c.x += nx * overlap;
            c.y += ny * overlap;
            const relN = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
            if (relN < 0) {
              a.vx += relN * nx;
              a.vy += relN * ny;
              c.vx -= relN * nx;
              c.vy -= relN * ny;
            }
          }
        }
      }

      for (const b of bodies) {
        if (!b.active) continue;
        clampSpeed(b);
        render(b);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Static atmosphere blooms (not physics bodies). */}
      {BLOOMS.map((o, i) => (
        <img
          key={`bloom-${i}`}
          src={`${basePath}/hero-glass/${o.img}.webp`}
          alt=""
          draggable={false}
          className="absolute hidden select-none sm:block"
          style={
            {
              left: o.pos.left,
              right: o.pos.right,
              top: o.pos.top,
              width: SIZE[o.size],
              transform: `rotate(${o.rot}deg)`,
              opacity: o.op,
              filter: `blur(${o.blur}px)`,
            } as CSSProperties
          }
        />
      ))}
      {/* Crystals — physics bodies (transform set by the sim). */}
      {BODIES.map((o, i) => (
        <div
          key={`body-${i}`}
          ref={(el) => {
            bodyEls.current[i] = el;
          }}
          className={`absolute left-0 top-0 will-change-transform ${o.layer === 'far' ? 'hidden sm:block' : ''}`}
        >
          <img
            src={`${basePath}/hero-glass/${o.img}.webp`}
            alt=""
            loading="lazy"
            draggable={false}
            style={
              {
                width: SIZE[o.size],
                opacity: o.op,
                filter: o.blur ? `blur(${o.blur}px)` : undefined,
              } as CSSProperties
            }
          />
        </div>
      ))}
    </div>
  );
}
