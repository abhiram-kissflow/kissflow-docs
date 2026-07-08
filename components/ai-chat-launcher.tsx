'use client';

import { useState } from 'react';
import AIChat from '@/components/ai-chat';
import { MessageCircle, X } from 'lucide-react';

function AskAIBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[#111722] shadow-[0_10px_25px_rgba(0,0,0,0.28)]">
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[0.8rem] bg-[#121826] text-white">
        <MessageCircle className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ff7a86] animate-pulse" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-[#111722]">Ask AI ✨</span>
    </span>
  );
}

export default function AIChatLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <div className="fixed bottom-36 right-4 z-50 h-[76vh] w-[min(440px,calc(100vw-1.5rem))] max-h-[820px] rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#111722] via-[#0e1420] to-[#0b111a] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.65)]">
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <div>
              <h2 className="text-base font-semibold text-white">Kissflow AI Assistant</h2>
              <div className="text-xs text-fd-muted-foreground">The team can also help</div>
            </div>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AIChat />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-5 z-40 transition-transform hover:-translate-y-0.5"
        aria-label="Open Ask AI assistant"
      >
        <AskAIBadge />
      </button>
    </>
  );
}
