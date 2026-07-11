'use client';

import { type CSSProperties, useEffect, useRef } from 'react';
import gsap from 'gsap';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Size tiers → responsive clamp widths.
const SIZE: Record<string, string> = {
  sm: 'clamp(2.5rem, 5vw, 4rem)',
  md: 'clamp(4.5rem, 9vw, 7.5rem)',
  lg: 'clamp(6.5rem, 13vw, 11rem)',
  xl: 'clamp(20rem, 48vw, 40rem)',
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

// Art-directed placement: everything lives in the side gutters / corners so the
// centered headline + ask box stay clear.
const OBJECTS: GlassObject[] = [
  // Near — big, out-of-focus foreground; strongest parallax (depth of field).
  { img: 'foreground', layer: 'near', pos: { left: '-8%', top: '44%' }, size: 'xl', rot: -6, op: 0.5, blur: 22 },
  { img: 'foreground', layer: 'near', pos: { right: '-12%', top: '-20%' }, size: 'xl', rot: 152, op: 0.42, blur: 28 },
  // Mid — the sharp hero objects.
  { img: 'pebble', layer: 'mid', pos: { left: '5%', top: '30%' }, size: 'lg', rot: -8, op: 0.95, blur: 0 },
  { img: 'cluster', layer: 'mid', pos: { left: '4%', top: '67%' }, size: 'md', rot: 4, op: 0.95, blur: 0 },
  { img: 'drop', layer: 'mid', pos: { left: '15%', top: '50%' }, size: 'md', rot: 0, op: 0.9, blur: 0 },
  { img: 'shard', layer: 'mid', pos: { right: '4%', top: '18%' }, size: 'lg', rot: 8, op: 0.95, blur: 0 },
  { img: 'lens', layer: 'mid', pos: { right: '5%', top: '58%' }, size: 'lg', rot: -6, op: 0.9, blur: 0 },
  { img: 'ribbon', layer: 'mid', pos: { right: '11%', top: '80%' }, size: 'lg', rot: 0, op: 0.9, blur: 0 },
  // Far — small, faint, softened; weakest parallax.
  { img: 'pebble', layer: 'far', pos: { left: '21%', top: '11%' }, size: 'sm', rot: 12, op: 0.5, blur: 2 },
  { img: 'shard', layer: 'far', pos: { right: '7%', top: '44%' }, size: 'sm', rot: -10, op: 0.5, blur: 2 },
  { img: 'drop', layer: 'far', pos: { left: '9%', top: '86%' }, size: 'sm', rot: 0, op: 0.5, blur: 2 },
  { img: 'lens', layer: 'far', pos: { left: '55%', top: '5%' }, size: 'sm', rot: 0, op: 0.45, blur: 2 },
  { img: 'cluster', layer: 'far', pos: { right: '19%', top: '87%' }, size: 'sm', rot: 0, op: 0.5, blur: 2 },
];

const PARALLAX: Record<Layer, number> = { far: 8, mid: 18, near: 36 };

/**
 * "Glass Depth Field" — a cinematic depth-of-field of photoreal frosted/liquid
 * glass objects (brand-colored, transparent PNGs) floating behind the hero: a
 * sharp mid layer, big out-of-focus foreground, and a soft far layer, each
 * parallaxing to the cursor by depth so you feel inside the material. Objects
 * drift and gently tumble (GSAP). Works on light and dark because each asset is a
 * self-lit transparent cutout; the side-gutter layout keeps the headline + ask
 * box clear. aria-hidden, pointer-events-none, static under prefers-reduced-motion.
 */
export function WingField() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        animate: '(prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (ctx) => {
        if (ctx.conditions?.reduce) return; // static composition, no motion

        // Per-object drift + gentle tumble (on the wrapper; base rotate is on the img).
        const objs = gsap.utils.toArray<HTMLElement>('.gf-obj', root);
        objs.forEach((el, i) => {
          gsap.to(el, {
            y: (i % 2 ? 1 : -1) * (10 + (i % 4) * 5),
            x: (i % 3 ? 1 : -1) * (6 + (i % 3) * 4),
            rotation: (i % 2 ? 1 : -1) * (3 + (i % 3) * 2),
            duration: 7 + (i % 5),
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: -(i % 6),
          });
        });

        // Cursor parallax: each depth layer shifts by its own strength.
        const layers = gsap.utils.toArray<HTMLElement>('.gf-layer', root);
        const setters = layers.map((el) => ({
          el,
          f: Number(el.dataset.parallax),
          xTo: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3' }),
          yTo: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3' }),
        }));
        const onMove = (e: PointerEvent) => {
          const r = root.getBoundingClientRect();
          if (!r.width) return;
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          setters.forEach((s) => {
            s.xTo(-px * s.f);
            s.yTo(-py * s.f);
          });
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
      },
      root,
    );

    return () => mm.revert();
  }, []);

  const layers: Layer[] = ['far', 'mid', 'near'];

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {layers.map((layer) => (
        <div
          key={layer}
          data-parallax={PARALLAX[layer]}
          className={`gf-layer absolute inset-0 ${layer !== 'mid' ? 'hidden sm:block' : ''}`}
        >
          {OBJECTS.filter((o) => o.layer === layer).map((o, i) => (
            <div
              key={`${o.img}-${layer}-${i}`}
              className="gf-obj absolute will-change-transform"
              style={{ left: o.pos.left, right: o.pos.right, top: o.pos.top }}
            >
              <img
                src={`${basePath}/hero-glass/${o.img}.webp`}
                alt=""
                loading="lazy"
                draggable={false}
                style={
                  {
                    width: SIZE[o.size],
                    transform: `rotate(${o.rot}deg)`,
                    opacity: o.op,
                    filter: o.blur ? `blur(${o.blur}px)` : undefined,
                  } as CSSProperties
                }
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
