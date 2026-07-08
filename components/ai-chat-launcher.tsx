'use client';

import { useState } from 'react';
import AIChat from '@/components/ai-chat';

export default function AIChatLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <div className="fixed right-4 bottom-4 z-40 h-[75vh] w-[min(420px,calc(100vw-2rem))] rounded-xl border bg-fd-background p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Kissflow AI Assistant</h2>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              className="rounded-md border px-2 py-1 text-xs"
            >
              Close
            </button>
          </div>
          <AIChat />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 rounded-full border bg-fd-primary px-4 py-3 text-sm font-medium text-fd-primary-foreground shadow-lg"
      >
        Ask AI
      </button>
    </>
  );
}
