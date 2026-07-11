'use client';

import { type CSSProperties, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';

// The four Kissflow signature colors (kissflow.com/brand) — the butterfly's wings.
const COLORS = ['#CF2C91', '#1F80FF', '#F58220', '#4AA147'];

// Deterministic PRNG so the server and client render identical petals — no
// hydration mismatch from Math.random().
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Petal {
  id: number;
  leftPct: number;
  topPct: number;
  color: string;
  size: number; // px
  depth: number; // 0 far … 1 near
  driftX: number;
  driftY: number;
  driftDur: number;
  spinDur: number;
  spinDir: number;
}

function makePetals(count: number): Petal[] {
  const rand = mulberry32(0x5eed);
  const petals: Petal[] = [];
  for (let i = 0; i < count; i++) {
    const depth = rand(); // 0..1
    petals.push({
      id: i,
      leftPct: rand() * 100,
      topPct: rand() * 100,
      color: COLORS[i % COLORS.length],
      size: 26 + depth * 74, // far small, near big
      depth,
      driftX: (rand() - 0.5) * 70 * (0.4 + depth),
      driftY: (rand() - 0.5) * 70 * (0.4 + depth),
      driftDur: 6 + rand() * 8,
      spinDur: 12 + rand() * 16,
      spinDir: rand() > 0.5 ? 1 : -1,
    });
  }
  return petals;
}

/**
 * "Living Wing-Field" — a shallow 3D diorama of brand-colored petals drifting in
 * layered depth behind the hero. Cursor-reactive tilt, a synchronized wingbeat
 * every ~8s, and per-petal 3D tumble. Reads on light and dark equally because the
 * petals ARE saturated brand colors (depth from blur + scale + motion, never glow
 * or shadow). GSAP-core only; respects prefers-reduced-motion.
 */
export function WingField() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const petals = useMemo(() => makePetals(22), []);

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
        // Reduced motion → leave the static arrangement, no animation.
        if (ctx.conditions?.reduce) return;

        const els = gsap.utils.toArray<HTMLElement>('.wf-petal', stage);

        // Per-petal drift + slow 3D tumble.
        els.forEach((el) => {
          const p = petals[Number(el.dataset.i)];
          gsap.to(el, {
            x: p.driftX,
            y: p.driftY,
            duration: p.driftDur,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: (-p.driftDur * (p.id % 5)) / 5, // desync start phases
          });
          gsap.to(el, {
            rotationY: 360 * p.spinDir,
            rotationX: 180 * p.spinDir,
            duration: p.spinDur,
            repeat: -1,
            ease: 'none',
          });
        });

        // Synchronized wingbeat — every ~8s all petals beat outward from center.
        const beat = gsap.timeline({ repeat: -1, repeatDelay: 6.5 });
        beat
          .to(els, {
            scale: 1.14,
            duration: 0.5,
            ease: 'power2.out',
            stagger: { each: 0.015, from: 'center' },
          })
          .to(
            els,
            {
              scale: 1,
              duration: 0.9,
              ease: 'power2.inOut',
              stagger: { each: 0.015, from: 'center' },
            },
            '>-0.1',
          );

        // Cursor-reactive 3D tilt of the whole stage.
        const rotY = gsap.quickTo(stage, 'rotationY', { duration: 0.8, ease: 'power3' });
        const rotX = gsap.quickTo(stage, 'rotationX', { duration: 0.8, ease: 'power3' });
        const onMove = (e: PointerEvent) => {
          const r = root.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          rotY(px * 14);
          rotX(-py * 14);
        };
        window.addEventListener('pointermove', onMove);

        // No fine pointer (touch) → gentle auto-sway instead.
        const sway = gsap.to(stage, {
          rotationY: 6,
          rotationX: -4,
          duration: 9,
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
  }, [petals]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      // Petals are translucent brand colors: on black they need a lift to match
      // their pop on white. --wf-boost multiplies each petal's opacity per theme.
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden [perspective:1100px] [--wf-boost:1] dark:[--wf-boost:1.6]"
    >
      <div ref={stageRef} className="absolute inset-0 [transform-style:preserve-3d]">
        {petals.map((p) => {
          const gid = `wf-grad-${p.id}`;
          const blur = (1 - p.depth) * 5; // far = blurred
          const opacity = 0.32 + p.depth * 0.3; // near = more opaque
          return (
            <div
              key={p.id}
              data-i={p.id}
              className="wf-petal absolute will-change-transform"
              style={
                {
                  left: `${p.leftPct}%`,
                  top: `${p.topPct}%`,
                  width: p.size,
                  height: p.size,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  '--wf-op': opacity,
                  opacity: 'min(1, calc(var(--wf-op) * var(--wf-boost, 1)))',
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none">
                <defs>
                  <linearGradient id={gid} x1="16" y1="1" x2="16" y2="31" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={p.color} stopOpacity="0.95" />
                    <stop offset="1" stopColor={p.color} stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                <path d="M16 1C24 9 24 23 16 31C8 23 8 9 16 1Z" fill={`url(#${gid})`} />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
