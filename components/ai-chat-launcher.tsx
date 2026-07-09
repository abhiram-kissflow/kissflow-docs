'use client';

import { useEffect, useState } from 'react';
import AIChat from '@/components/ai-chat';
import { MessageCircle, X } from 'lucide-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function KissflowAnimatedLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-fd-border bg-fd-background shadow-[0_8px_22px_rgba(0,0,0,0.2)]">
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_15%_20%,rgba(207,44,145,0.24),transparent_55%),radial-gradient(circle_at_85%_75%,rgba(63,115,255,0.24),transparent_55%)] animate-[kf-logo-glow_2.8s_ease-in-out_infinite]" />
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="relative h-8 w-8 rounded-full object-cover"
        >
          <source src={`${basePath}/branding/kissflow-butterfly.mp4`} type="video/mp4" />
        </video>
      </span>
      <span className="relative inline-flex items-center rounded-full border border-fd-border/80 bg-fd-background px-2 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
        <img
          src={`${basePath}/kissflow-logo.png`}
          alt="Kissflow"
          className="h-4 w-auto animate-[kf-logo-float_2.8s_ease-in-out_infinite] dark:hidden"
        />
        <img
          src={`${basePath}/kissflow-logo-white.png`}
          alt="Kissflow"
          className="hidden h-4 w-auto animate-[kf-logo-float_2.8s_ease-in-out_infinite] dark:block"
        />
      </span>
    </span>
  );
}

function AskAIBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-background/95 px-3 py-2 text-fd-foreground shadow-[0_10px_25px_rgba(0,0,0,0.22)] backdrop-blur">
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[0.8rem] bg-[#121826] text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
        <MessageCircle className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ff7a86] animate-pulse" />
      </span>
      <span className="text-sm font-semibold tracking-tight">Ask AI ✨</span>
    </span>
  );
}

export default function AIChatLauncher() {
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem('kissflow-ask-ai-nudge-dismissed');
    if (!dismissed) setShowNudge(true);
  }, []);

  function dismissNudge() {
    setShowNudge(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kissflow-ask-ai-nudge-dismissed', '1');
    }
  }

  function openAssistant() {
    setOpen(true);
    dismissNudge();
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 left-3 right-3 z-50 h-[min(78vh,820px)] overflow-hidden rounded-[2rem] border border-fd-border bg-fd-background/95 shadow-[0_28px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:bottom-24 sm:left-auto sm:right-5 sm:w-[440px]">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(207,44,145,0.15),rgba(207,44,145,0.8),rgba(63,115,255,0.82),rgba(207,44,145,0.15))] bg-[length:200%_100%] animate-[kf-shimmer_3.2s_linear_infinite]" />
          <div className="flex h-full min-h-0 flex-col p-3">
            <div className="mb-2 flex items-center justify-between rounded-2xl border border-fd-border bg-fd-card px-3 py-2">
              <div className="flex items-center gap-2">
                <KissflowAnimatedLogo />
                <h2 className="text-base font-semibold text-fd-foreground">Kissflow AI Assistant</h2>
              </div>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-fd-border text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AIChat />
            </div>
          </div>
        </div>
      ) : null}

      {!open ? (
        <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-5">
          {showNudge ? (
            <div className="relative w-[min(88vw,360px)] rounded-2xl border border-fd-border bg-fd-card/95 p-3 pr-10 text-fd-foreground shadow-[0_18px_45px_rgba(0,0,0,0.25)] backdrop-blur">
              <button
                type="button"
                aria-label="Dismiss Ask AI tip"
                onClick={dismissNudge}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openAssistant}
                className="text-left"
              >
                <p className="text-sm font-semibold">Need help finding the right doc?</p>
                <p className="mt-1 text-sm text-fd-muted-foreground">
                  Ask AI for feature guides, setup steps, and API documentation.
                </p>
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={openAssistant}
            className="transition-transform hover:-translate-y-0.5"
            aria-label="Open Ask AI assistant"
          >
            <AskAIBadge />
          </button>
        </div>
      ) : null}
    </>
  );
}
