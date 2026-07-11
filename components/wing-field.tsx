'use client';

import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';

// The four Kissflow signature colors (kissflow.com/brand), as RGB triples.
const COLORS: [number, number, number][] = [
  [207, 44, 145], // #CF2C91 magenta
  [31, 128, 255], // #1F80FF blue
  [245, 130, 32], // #F58220 orange
  [74, 161, 71], // #4AA147 green
];

const TILE_COUNT = 40;

// Deterministic PRNG so server and client render identical tiles — no hydration
// mismatch from Math.random().
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tile {
  id: number;
  leftPct: number;
  topPct: number;
  rgb: [number, number, number];
  size: number; // px
  depth: number; // 0 far … 1 near
  rot: number; // initial z rotation
  driftX: number;
  driftY: number;
  driftDur: number;
  swing: number; // tumble amplitude (deg)
  swingDur: number;
}

function makeTiles(count: number): Tile[] {
  const rand = mulberry32(0x91a5);
  const tiles: Tile[] = [];
  for (let i = 0; i < count; i++) {
    const depth = rand(); // 0..1
    tiles.push({
      id: i,
      leftPct: rand() * 100,
      topPct: rand() * 100,
      rgb: COLORS[i % COLORS.length],
      size: 22 + depth * 74, // small, near ones a bit bigger
      depth,
      rot: (rand() - 0.5) * 40,
      driftX: (rand() - 0.5) * 80 * (0.4 + depth),
      driftY: (rand() - 0.5) * 80 * (0.4 + depth),
      driftDur: 8 + rand() * 9,
      swing: 12 + rand() * 20,
      swingDur: 7 + rand() * 8,
    });
  }
  return tiles;
}

/**
 * "Frosted Glass Drift" — a shallow 3D depth field of small frosted-glass tiles
 * (a nod to Kissflow boards/cards) floating behind the hero. Each tile is a
 * translucent, backdrop-blurred pane with a brand-tinted rim and a luminous top
 * edge; they drift and gently tumble in 3D, and the whole field parallax-tilts to
 * the cursor. Reads as glass on light AND dark via per-theme frost/rim/edge vars.
 * A soft central clearing keeps the headline + ask box crisp. GSAP-core only;
 * respects prefers-reduced-motion.
 */
export function WingField() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => makeTiles(TILE_COUNT), []);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        animate: '(prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        if (ctx.conditions?.reduce) return; // static arrangement, no motion

        const els = gsap.utils.toArray<HTMLElement>('.glass-tile', stage);

        els.forEach((el) => {
          const t = tiles[Number(el.dataset.i)];
          // Slow drift.
          gsap.to(el, {
            x: t.driftX,
            y: t.driftY,
            duration: t.driftDur,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: (-t.driftDur * (t.id % 5)) / 5,
          });
          // Gentle 3D tumble — panes catching light, not spinning.
          gsap.to(el, {
            rotationY: t.swing,
            rotationX: -t.swing * 0.7,
            duration: t.swingDur,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        });

        // Cursor-reactive 3D tilt of the whole field (immersive parallax).
        const rotY = gsap.quickTo(stage, 'rotationY', { duration: 0.9, ease: 'power3' });
        const rotX = gsap.quickTo(stage, 'rotationX', { duration: 0.9, ease: 'power3' });
        const onMove = (e: PointerEvent) => {
          const r = root.getBoundingClientRect();
          if (!r.width) return;
          rotY(((e.clientX - r.left) / r.width - 0.5) * 12);
          rotX(((e.clientY - r.top) / r.height - 0.5) * -12);
        };
        window.addEventListener('pointermove', onMove);

        // Touch (no fine pointer) → gentle auto-sway.
        const sway = gsap.to(stage, {
          rotationY: 5,
          rotationX: -3,
          duration: 10,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          paused: true,
        });
        if (!window.matchMedia('(pointer: fine)').matches) sway.play();

        return () => window.removeEventListener('pointermove', onMove);
      },
      root,
    );

    return () => mm.revert();
  }, [tiles]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      // Per-theme glass vars: frost = pane fill, rim = border, edge = top highlight.
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden [perspective:1200px] [--frost:0.5] [--rim:0.5] [--edge:0.65] dark:[--frost:0.14] dark:[--rim:0.62] dark:[--edge:0.28]"
    >
      <div ref={stageRef} className="absolute inset-0 [transform-style:preserve-3d]">
        {tiles.map((t) => {
          const [r, g, b] = t.rgb;
          const blur = (1 - t.depth) * 3; // far = softer (depth of field)
          const opacity = 0.5 + t.depth * 0.45; // near = more present
          return (
            <div
              key={t.id}
              data-i={t.id}
              className="glass-tile absolute rounded-[32%] border will-change-transform [backdrop-filter:blur(6px)] [-webkit-backdrop-filter:blur(6px)]"
              style={
                {
                  left: `${t.leftPct}%`,
                  top: `${t.topPct}%`,
                  width: t.size,
                  height: t.size,
                  marginLeft: -t.size / 2,
                  marginTop: -t.size / 2,
                  transform: `rotate(${t.rot}deg)`,
                  opacity,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  background: `linear-gradient(135deg, rgba(255,255,255,var(--frost)) 0%, rgba(${r},${g},${b},0.14) 100%)`,
                  borderColor: `rgba(${r},${g},${b},var(--rim))`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,var(--edge)), 0 8px 24px rgba(${r},${g},${b},0.10)`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
