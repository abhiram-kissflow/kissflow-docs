import { type CSSProperties } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Size tiers → responsive clamp widths.
const SIZE: Record<string, string> = {
  xl: 'clamp(23rem, 55vw, 45rem)',
};

interface Bloom {
  pos: { left?: string; right?: string; top: string };
  size: keyof typeof SIZE;
  rot: number;
  op: number;
  blur: number;
}

// Static, out-of-focus glass blooms — the soft colour wash behind the hero.
// The moving crystals (physics bodies) were removed; only atmosphere remains.
const BLOOMS: Bloom[] = [
  // ponytail: left bloom removed — its pink clashed with the ASCII-rain on that side.
  { pos: { right: '-12%', top: '-18%' }, size: 'xl', rot: 152, op: 0.42, blur: 28 },
];

export function WingField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {BLOOMS.map((o, i) => (
        <img
          key={`bloom-${i}`}
          src={`${basePath}/hero-glass/foreground.webp`}
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
    </div>
  );
}
