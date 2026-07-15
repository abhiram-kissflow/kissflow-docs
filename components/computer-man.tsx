'use client';

import { useEffect, useRef } from 'react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4';
const SENSITIVITY = 0.8;

// Ambient hero figure — the computer-man. His head turns with horizontal cursor
// movement (video is scrubbed, never autoplays). Right-anchored and masked so he
// melts into the colour wash instead of reading as a video panel.
export function ComputerMan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevX = useRef<number | null>(null);
  const targetTime = useRef(0);
  const seeking = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const video = videoRef.current;
      const dur = video?.duration;
      if (!video || !dur || Number.isNaN(dur)) {
        prevX.current = e.clientX;
        return;
      }
      if (prevX.current === null) {
        prevX.current = e.clientX;
        return;
      }
      const delta = e.clientX - prevX.current;
      prevX.current = e.clientX;
      const offset = (delta / window.innerWidth) * SENSITIVITY * dur;
      targetTime.current = Math.max(0, Math.min(dur, targetTime.current + offset));
      if (!seeking.current) {
        seeking.current = true;
        video.currentTime = targetTime.current;
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // After each seek settles, queue the next one if the target moved (anti-flood).
  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - targetTime.current) > 0.01) {
      video.currentTime = targetTime.current;
    } else {
      seeking.current = false;
    }
  };

  return (
    <video
      ref={videoRef}
      aria-hidden
      src={VIDEO_SRC}
      muted
      playsInline
      preload="auto"
      onSeeked={handleSeeked}
      className="pointer-events-none absolute right-0 top-0 z-0 hidden h-full w-[58%] select-none object-cover opacity-90 md:block"
      style={{
        objectPosition: '50% 20%',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to bottom, transparent 0%, #000 14%, #000 60%, transparent 96%)',
        maskImage:
          'linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to bottom, transparent 0%, #000 14%, #000 60%, transparent 96%)',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      }}
    />
  );
}
