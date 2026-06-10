'use client';

import { usePathname } from 'next/navigation';
import { personas, personaFromPath } from '@/lib/personas';

export function AIPageActions() {
  const pathname = usePathname();
  const personaId = personaFromPath(pathname);
  const persona = personas[personaId];

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const mdUrl = pageUrl ? `${pageUrl}.md` : '';

  function buildClaudeUrl(): string {
    const prompt = `${persona.promptFrame}\n\nDocumentation page: ${pageUrl}\n\nPlease read the page content at ${mdUrl} and help me.`;
    return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
  }

  function buildChatGPTUrl(): string {
    const prompt = `${persona.promptFrame}\n\nDocumentation page: ${pageUrl}\n\nPlease read the page content at ${mdUrl} and help me.`;
    return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-fd-border">
      <a
        href={buildClaudeUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50 transition-colors"
      >
        Open in Claude
      </a>
      <a
        href={buildChatGPTUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-green-50 text-green-800 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-200 dark:hover:bg-green-950/50 transition-colors"
      >
        Open in ChatGPT
      </a>
    </div>
  );
}
