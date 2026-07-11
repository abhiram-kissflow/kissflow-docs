'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// The four Kissflow signature colors (kissflow.com/brand), as RGB triples.
const COLORS: [number, number, number][] = [
  [207, 44, 145], // #CF2C91 magenta
  [31, 128, 255], // #1F80FF blue
  [245, 130, 32], // #F58220 orange
  [74, 161, 71], // #4AA147 green
];

const PARTICLE_COUNT = 2400;

interface Particle {
  // Butterfly target (model space, roughly [-1,1] with depth z).
  bx: number;
  by: number;
  bz: number;
  // Flow "home" (screen fractions) + individual drift phase/speed.
  hx: number;
  hy: number;
  phase: number;
  speed: number;
  amp: number;
  rgb: [number, number, number];
  size: number;
}

// Fay's parametric butterfly curve, area-filled and colored by wing region.
function makeButterfly(count: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const r =
      Math.exp(Math.sin(t)) -
      2 * Math.cos(4 * t) +
      Math.pow(Math.sin((2 * t - Math.PI) / 24), 5);
    const fill = Math.sqrt(Math.random()); // uniform area fill
    // Curve is drawn "lying down"; swap axes so the butterfly stands upright.
    const bx = Math.cos(t) * r * fill;
    const by = -Math.sin(t) * r * fill;
    // Colour by wing: left/right split, upper/lower split → 4 brand colours.
    const ci = (bx < 0 ? 0 : 1) + (by < 0 ? 0 : 2);
    out.push({
      bx,
      by,
      bz: (Math.random() - 0.5) * 1.2, // thickness → real 3D on rotation
      hx: Math.random(),
      hy: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.5,
      amp: 0.02 + Math.random() * 0.05,
      rgb: COLORS[ci],
      size: 1.4 + Math.random() * 1.4,
    });
  }
  return out;
}

/**
 * "Butterfly Flow-Field" — an immersive current of brand-colored particles that
 * periodically coalesces into a slowly-rotating Kissflow butterfly, then breathes
 * back into flow. Canvas 2D + GSAP-driven scalars (morph, rotation, cursor tilt);
 * no Three.js. Reads on light and dark equally (particles ARE saturated brand
 * colors; a per-theme alpha keeps them even on black and white). A soft central
 * clearing protects the headline + ask box. Honors prefers-reduced-motion.
 */
export function WingField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = makeButterfly(PARTICLE_COUNT);
    // GSAP animates these scalars; the render loop reads them each frame.
    const state = { morph: 0, rot: 0, tiltX: 0, tiltY: 0 };

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Theme parity: brand colors need a touch more alpha on black than on white.
    let alphaBoost = 1;
    const readTheme = () => {
      alphaBoost = document.documentElement.classList.contains('dark') ? 1.5 : 1;
    };
    readTheme();
    const themeObs = new MutationObserver(readTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H * 0.46;
      const scale = Math.min(W, H) * 0.32; // butterfly size
      const clearR = Math.min(W, H) * 0.26; // central clearing radius
      const time = performance.now() * 0.001;
      const cosY = Math.cos(state.rot + state.tiltY);
      const sinY = Math.sin(state.rot + state.tiltY);
      const cosX = Math.cos(state.tiltX);
      const sinX = Math.sin(state.tiltX);

      for (const p of particles) {
        // Butterfly position: rotate model point in 3D, project to screen.
        const x1 = p.bx * cosY + p.bz * sinY;
        const z1 = -p.bx * sinY + p.bz * cosY;
        const y1 = p.by * cosX - z1 * sinX;
        const z2 = p.by * sinX + z1 * cosX;
        const persp = 1 / (1 + z2 * 0.28);
        const bxS = cx + x1 * scale * persp;
        const byS = cy + y1 * scale * persp;

        // Flow position: a streaming current across the viewport.
        const fx = ((p.hx + time * 0.012 * p.speed) % 1.15) * W - W * 0.075;
        const fy = (p.hy * H + Math.sin(time * p.speed + p.phase) * p.amp * H + H) % H;

        const m = state.morph;
        const sx = fx + (bxS - fx) * m;
        const sy = fy + (byS - fy) * m;

        // Soft central clearing so the headline + ask box stay crisp.
        const dx = sx - cx;
        const dy = sy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let clear = 1;
        if (dist < clearR) clear = 0.12 + 0.88 * (dist / clearR);

        const depthAlpha = 0.35 + 0.4 * persp; // near brighter
        const a = Math.min(0.9, depthAlpha * clear * alphaBoost);
        if (a < 0.02) continue;
        const sz = p.size * (0.7 + 0.6 * persp);
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]})`;
        ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    };

    let rafId = 0;
    let extraCleanup = () => {};
    let tl: gsap.core.Timeline | null = null;
    let rotTween: gsap.core.Tween | null = null;

    if (reduce) {
      // Calm, static: a formed butterfly, no motion.
      state.morph = 1;
      draw();
    } else {
      const loop = () => {
        draw();
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);

      // Continuous slow rotation (the butterfly turns; the flow shears).
      rotTween = gsap.to(state, { rot: Math.PI * 2, duration: 46, repeat: -1, ease: 'none' });

      // The breath: flow → form → hold → disperse → flow.
      tl = gsap.timeline({ repeat: -1 });
      tl.to(state, { morph: 1, duration: 3, ease: 'power2.inOut' })
        .to(state, { morph: 1, duration: 3.2 }) // hold formed
        .to(state, { morph: 0, duration: 3.4, ease: 'power2.inOut' })
        .to(state, { morph: 0, duration: 4 }); // hold flow

      // Cursor steers the cloud (immersive parallax).
      const tiltYTo = gsap.quickTo(state, 'tiltY', { duration: 1, ease: 'power3' });
      const tiltXTo = gsap.quickTo(state, 'tiltX', { duration: 1, ease: 'power3' });
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        if (!r.width) return;
        tiltYTo(((e.clientX - r.left) / r.width - 0.5) * 0.6);
        tiltXTo(((e.clientY - r.top) / r.height - 0.5) * -0.4);
      };
      window.addEventListener('pointermove', onMove);

      // Pause the loop when the tab is hidden (perf; rAF already throttles).
      const onVis = () => {
        cancelAnimationFrame(rafId);
        if (!document.hidden) rafId = requestAnimationFrame(loop);
      };
      document.addEventListener('visibilitychange', onVis);

      extraCleanup = () => {
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('visibilitychange', onVis);
      };
    }

    return () => {
      cancelAnimationFrame(rafId);
      rotTween?.kill();
      tl?.kill();
      themeObs.disconnect();
      window.removeEventListener('resize', resize);
      extraCleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
